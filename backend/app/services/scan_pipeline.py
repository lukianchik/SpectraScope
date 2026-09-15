from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from collections import Counter
from datetime import datetime
from html import unescape
from typing import TypeVar
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models import Asset, Finding, RiskReport, Scan, Service
from app.core.metrics import SCAN_PIPELINE_DURATION_SECONDS, SCANS_COMPLETED_TOTAL, SCANS_FAILED_TOTAL
from app.scanners.httpx import HttpxAdapter
from app.scanners.nmap import NmapAdapter
from app.scanners.nuclei import NucleiAdapter
from app.scanners.subfinder import SubfinderAdapter
from app.services.network_policy import validate_external_network_targets
from app.services.integration_delivery import deliver_scan_notifications
from app.services.scan_profiles import (
    LAB_PROFILE,
    LOCAL_REAL_PROFILE,
    normalize_scan_profile,
    should_run_nmap_stage,
    should_run_nuclei_stage,
)
from app.services.target_validation import normalize_target, split_target_host_port

logger = logging.getLogger(__name__)
StageResult = TypeVar("StageResult")


class ScanCancelled(RuntimeError):
    pass

SEVERITY_ORDER = {"critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1}
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)

LAB_FINDING_DEFINITIONS = {
    "admin.lab.local:8088": {
        "name": "Exposed Admin Panel Demo",
        "severity": "high",
        "template_id": "lab-exposed-admin-panel-demo",
        "description": "Publicly reachable admin panel was detected in the local SpectraScope demo lab.",
        "recommendations": [
            "Restrict public access to the admin panel with authentication and network controls.",
            "Review internet-exposed admin surfaces before promoting the environment.",
        ],
    },
    "legacy.lab.local:8088": {
        "name": "Legacy Service Demo",
        "severity": "medium",
        "template_id": "lab-legacy-service-demo",
        "description": "Legacy demo service with outdated headers was detected in the local SpectraScope demo lab.",
        "recommendations": [
            "Plan remediation or retirement for the legacy service footprint.",
            "Upgrade the service stack and verify that outdated response headers are gone.",
        ],
    },
    "files.lab.local:8088": {
        "name": "Directory Listing Demo",
        "severity": "medium",
        "template_id": "lab-directory-listing-demo",
        "description": "Directory listing content was exposed by the local SpectraScope demo lab.",
        "recommendations": [
            "Disable directory listing on the exposed file service.",
            "Remove unintended backup and legacy files from the public directory.",
        ],
    },
}


def run_scan_pipeline(scan_id: str, db: Session, settings: Settings | None = None) -> None:
    started_at_monotonic = time.perf_counter()
    settings = settings or get_settings()
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise ValueError(f"Scan {scan_id} not found")
    if scan.status not in {"created", "failed"}:
        logger.info("Skipping scan pipeline for scan_id=%s with status=%s", scan_id, scan.status)
        return

    try:
        scan.status = "running"
        scan.started_at = datetime.utcnow()
        scan.finished_at = None
        scan.error_message = None
        scan.current_stage = "starting"
        scan.progress_percent = 5
        scan.cancellation_requested = False
        scan.stage_diagnostics = []
        scan.assets.clear()
        scan.findings.clear()
        if scan.report is not None:
            db.delete(scan.report)
            scan.report = None
        db.commit()

        target = normalize_target(scan.target)
        scan_profile = normalize_scan_profile(scan.scan_profile)
        logger.info("Starting safe scan pipeline for target=%s scan_id=%s profile=%s", target, scan_id, scan_profile)

        if scan_profile == LAB_PROFILE:
            if not settings.lab_mode:
                raise RuntimeError("scan_profile 'lab' requires LAB_MODE=true")
            _set_progress(scan, db, "lab_fetch", 30)
            _run_lab_mode_pipeline(scan, db, settings, target)
            scan.status = "completed"
            scan.current_stage = "completed"
            scan.progress_percent = 100
            scan.finished_at = datetime.utcnow()
            db.commit()
            deliver_scan_notifications(db, scan, settings)
            SCANS_COMPLETED_TOTAL.inc()
            SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
            logger.info("Completed LAB_MODE scan pipeline scan_id=%s findings=%s", scan_id, len(scan.findings))
            return

        if settings.lab_mode:
            raise RuntimeError("LAB_MODE only supports scan_profile 'lab'")

        if scan_profile == LOCAL_REAL_PROFILE:
            hostnames = _local_real_hostnames(target, settings)
        else:
            discovery_target, _ = split_target_host_port(target)
            _set_progress(scan, db, "discovery", 15)
            subdomains = _run_tracked_stage(
                scan,
                db,
                "discovery",
                "subfinder",
                lambda: SubfinderAdapter(settings).discover(discovery_target),
                target_count=1,
            )
            hostnames = list(dict.fromkeys([target, *(result.hostname for result in subdomains)]))

        validate_external_network_targets(hostnames, settings)

        _ensure_not_cancelled(scan, db)
        _set_progress(scan, db, "probing", 35)
        alive_results = _run_tracked_stage(
            scan,
            db,
            "probing",
            "httpx",
            lambda: HttpxAdapter(settings).probe(hostnames),
            target_count=len(hostnames),
        )
        assets_by_hostname: dict[str, Asset] = {}
        for result in alive_results:
            asset = Asset(
                scan_id=scan.id,
                hostname=result.hostname,
                ip=result.ip,
                is_alive=True,
                http_status=result.status_code,
                title=result.title,
                technologies=result.technologies,
            )
            db.add(asset)
            assets_by_hostname[result.hostname] = asset

        db.flush()

        if should_run_nuclei_stage(scan_profile):
            _ensure_not_cancelled(scan, db)
            _set_progress(scan, db, "nuclei", 65)
            urls = [result.url for result in alive_results if result.url]
            validate_external_network_targets(urls, settings)
            nuclei_findings = _run_tracked_stage(
                scan,
                db,
                "nuclei",
                "nuclei",
                lambda: NucleiAdapter(settings).scan(urls),
                target_count=len(urls),
            )
            seen_findings: set[tuple[str, str | None, str]] = set()
            for result in nuclei_findings:
                hostname = _hostname_from_finding_host(result.host)
                asset = assets_by_hostname.get(hostname)
                dedupe_key = (hostname, result.template_id, result.name)
                if dedupe_key in seen_findings:
                    continue
                seen_findings.add(dedupe_key)
                finding = Finding(
                    scan_id=scan.id,
                    asset_id=asset.id if asset else None,
                    source_tool="nuclei",
                    template_id=result.template_id,
                    name=result.name,
                    severity=_normalize_severity(result.severity),
                    description=result.description,
                    matched_at=result.matched_at,
                    cve=result.cve,
                    cvss=result.cvss,
                    raw_json=result.raw_json,
                )
                db.add(finding)

        if should_run_nmap_stage(scan_profile):
            _ensure_not_cancelled(scan, db)
            _set_progress(scan, db, "service_detection", 80)
            service_results = _run_tracked_stage(
                scan,
                db,
                "service_detection",
                "nmap",
                lambda: NmapAdapter(settings).scan_services(list(assets_by_hostname)),
                target_count=len(assets_by_hostname),
            )
            for result in service_results:
                asset = assets_by_hostname.get(result.host)
                if asset is None:
                    continue
                db.add(
                    Service(
                        asset_id=asset.id,
                        port=result.port,
                        protocol=result.protocol,
                        service_name=result.service_name,
                        product=result.product,
                        version=result.version,
                        banner=result.banner,
                    )
                )

        db.flush()
        _ensure_not_cancelled(scan, db)
        _set_progress(scan, db, "reporting", 92)
        report = _run_tracked_stage(
            scan,
            db,
            "reporting",
            "spectrascope",
            lambda: build_risk_report(scan, list(scan.findings), len(assets_by_hostname)),
            target_count=len(assets_by_hostname),
        )
        db.add(report)

        scan.status = "completed"
        scan.current_stage = "completed"
        scan.progress_percent = 100
        scan.finished_at = datetime.utcnow()
        db.commit()
        deliver_scan_notifications(db, scan, settings)
        SCANS_COMPLETED_TOTAL.inc()
        SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
        logger.info("Completed scan pipeline scan_id=%s assets=%s findings=%s", scan_id, len(assets_by_hostname), len(scan.findings))
    except ScanCancelled:
        db.rollback()
        cancelled_scan = db.get(Scan, scan_id)
        if cancelled_scan is not None:
            cancelled_scan.status = "cancelled"
            cancelled_scan.current_stage = "cancelled"
            cancelled_scan.finished_at = datetime.utcnow()
            db.commit()
        logger.info("Cancelled scan pipeline scan_id=%s", scan_id)
    except Exception as exc:
        logger.exception("Scan pipeline failed scan_id=%s", scan_id)
        db.rollback()
        failed_scan = db.get(Scan, scan_id)
        if failed_scan is not None:
            failed_scan.status = "failed"
            failed_scan.current_stage = "failed"
            failed_scan.finished_at = datetime.utcnow()
            failed_scan.error_message = str(exc)
            db.commit()
        SCANS_FAILED_TOTAL.inc()
        SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
        raise


def _run_stage(stage: str, scan_id: str, action: Callable[[], StageResult]) -> StageResult:
    logger.info("Starting scanner stage=%s scan_id=%s", stage, scan_id)
    try:
        result = action()
    except Exception as exc:
        logger.exception("Scanner stage failed stage=%s scan_id=%s error=%s", stage, scan_id, exc)
        raise RuntimeError(f"{stage} stage failed: {exc}") from exc
    logger.info("Completed scanner stage=%s scan_id=%s", stage, scan_id)
    return result


def _run_tracked_stage(
    scan: Scan,
    db: Session,
    stage: str,
    tool: str,
    action: Callable[[], StageResult],
    *,
    target_count: int | None = None,
) -> StageResult:
    started_at = datetime.utcnow()
    diagnostic = {
        "stage": stage,
        "tool": tool,
        "status": "running",
        "started_at": started_at.isoformat(),
        "finished_at": None,
        "duration_ms": None,
        "target_count": target_count,
        "result_count": None,
        "exit_code": None,
        "error": None,
    }
    _store_stage_diagnostic(scan, db, diagnostic)

    try:
        result = _run_stage(stage, scan.id, action)
    except Exception as exc:
        finished_at = datetime.utcnow()
        diagnostic.update(
            status="failed",
            finished_at=finished_at.isoformat(),
            duration_ms=_duration_ms(started_at, finished_at),
            error=str(exc),
        )
        _store_stage_diagnostic(scan, db, diagnostic)
        raise

    finished_at = datetime.utcnow()
    diagnostic.update(
        status="completed",
        finished_at=finished_at.isoformat(),
        duration_ms=_duration_ms(started_at, finished_at),
        result_count=_result_count(result),
        exit_code=0,
    )
    _store_stage_diagnostic(scan, db, diagnostic)
    return result


def _store_stage_diagnostic(scan: Scan, db: Session, diagnostic: dict) -> None:
    diagnostics = [
        item for item in (scan.stage_diagnostics or []) if item.get("stage") != diagnostic["stage"]
    ]
    scan.stage_diagnostics = [*diagnostics, dict(diagnostic)]
    db.commit()


def _duration_ms(started_at: datetime, finished_at: datetime) -> int:
    return max(0, round((finished_at - started_at).total_seconds() * 1000))


def _result_count(result: object) -> int:
    if result is None:
        return 0
    if isinstance(result, (list, tuple, set, dict)):
        return len(result)
    return 1


def _set_progress(scan: Scan, db: Session, stage: str, percent: int) -> None:
    scan.current_stage = stage
    scan.progress_percent = max(0, min(100, percent))
    db.commit()


def _ensure_not_cancelled(scan: Scan, db: Session) -> None:
    db.refresh(scan)
    if scan.cancellation_requested or scan.status == "cancelled":
        raise ScanCancelled()


def build_risk_report(scan: Scan, findings: list[Finding], asset_count: int) -> RiskReport:
    if _is_site_preview_report(findings):
        return RiskReport(
            scan_id=scan.id,
            summary=(
                f"SpectraScope scanned {scan.target} and detected 15 security findings across 24 live assets. "
                "The most significant risk is an exposed admin panel that could allow unauthorized access. "
                "Several assets are missing basic security headers and should be hardened."
            ),
            top_risks=[
                _preview_risk("Exposed Admin Panel", "high", 1, "Restrict the panel behind strong authentication and approved network paths."),
                _preview_risk("Missing Security Headers", "medium", 8, "Apply a consistent browser security-header baseline."),
                _preview_risk("Directory Listing Enabled", "medium", 2, "Disable directory indexing and remove unintended files."),
                _preview_risk("Outdated Server Version", "medium", 3, "Upgrade or retire the exposed software version."),
                _preview_risk("TLS Certificate Expiring Soon", "low", 2, "Renew the certificate and verify automated rotation."),
            ],
            recommendations=[
                f"Secure or remove the exposed admin panel on admin.{scan.target}.",
                "Implement security headers (CSP, HSTS, X-Frame-Options) across all web assets.",
                "Update outdated software and re-scan to verify remediation.",
            ],
        )

    severity_counts = Counter(finding.severity for finding in findings)
    grouped_findings: dict[tuple[str, str], list[Finding]] = {}
    for finding in findings:
        key = (finding.template_id or finding.name, finding.name)
        grouped_findings.setdefault(key, []).append(finding)

    ranked_groups = sorted(
        grouped_findings.values(),
        key=lambda group: (
            max(SEVERITY_ORDER.get(item.severity, 0) for item in group),
            len({item.asset_id for item in group if item.asset_id}),
        ),
        reverse=True,
    )[:5]
    top_risks = []
    for group in ranked_groups:
        representative = max(group, key=lambda item: SEVERITY_ORDER.get(item.severity, 0))
        affected_assets = len({item.asset_id for item in group if item.asset_id}) or 1
        asset_ids = sorted({item.asset_id for item in group if item.asset_id})
        finding_ids = sorted({item.id for item in group if item.id})
        recommended_action = _recommendation_for_finding(representative)
        top_risks.append(
            {
                "name": representative.name,
                "severity": representative.severity,
                "score": representative.cvss or _severity_score(representative.severity),
                "affected_assets": affected_assets,
                "source_tool": representative.source_tool,
                "template_id": representative.template_id,
                "cve": representative.cve,
                "finding_ids": finding_ids,
                "asset_ids": asset_ids,
                "matched_at": representative.matched_at,
                "reason": (
                    f"{representative.severity.title()} observation from {representative.source_tool} "
                    f"was confirmed on {affected_assets} reachable asset(s)."
                ),
                "recommended_action": recommended_action,
            }
        )

    risk_score = min(100, sum(SEVERITY_ORDER.get(finding.severity, 0) for finding in findings))
    severity_summary = ", ".join(
        f"{count} {severity}" for severity, count in severity_counts.most_common()
    ) or "no security observations"
    summary = (
        f"Scan for {scan.target} discovered {asset_count} alive asset(s) and {len(findings)} finding(s). "
        f"Observed severity mix: {severity_summary}. Calculated baseline risk score: {risk_score}/100. "
        "This report is generated from a safe MVP pipeline and is not evidence of exploitation."
    )
    recommendations = _build_finding_recommendations(findings)

    return RiskReport(
        scan_id=scan.id,
        summary=summary,
        top_risks=top_risks,
        recommendations=recommendations,
    )


def _local_real_hostnames(target: str, settings: Settings) -> list[str]:
    scope_target = settings.local_real_scope_target.strip().lower()
    if target != scope_target:
        return [target]

    targets = [item for item in settings.allowed_lab_target_list if item != scope_target]
    if not targets:
        raise RuntimeError("Local perimeter scope has no allowed child targets")
    return targets


def _severity_score(severity: str) -> float:
    return {
        "critical": 9.5,
        "high": 8.0,
        "medium": 5.5,
        "low": 3.0,
        "info": 0.0,
    }.get(severity, 0.0)


def _build_finding_recommendations(findings: list[Finding]) -> list[str]:
    recommendations = [_recommendation_for_finding(finding) for finding in findings]
    if any(finding.severity in {"critical", "high"} for finding in findings):
        recommendations.append(
            "Assign critical and high findings to responsible asset owners for immediate validation."
        )

    recommendations.extend(
        [
            "Confirm that every externally reachable asset is expected and has a documented owner.",
            "Validate scanner evidence manually before making remediation or risk-acceptance decisions.",
        ]
    )
    return list(dict.fromkeys(recommendations))


def _recommendation_for_finding(finding: Finding) -> str:
    template_id = finding.template_id or ""
    if "admin-panel" in template_id:
        return "Restrict administrative interfaces with authentication, VPN access, and network allowlists."
    if "directory-listing" in template_id:
        return "Disable directory listing and remove backup or legacy files from public web roots."
    if "legacy-service" in template_id:
        return "Upgrade or retire legacy services and verify that obsolete server banners are no longer exposed."
    if "security-headers" in template_id:
        return "Define a browser security-header baseline, including CSP and clickjacking protection, then re-scan."
    return "Validate the scanner evidence, assign an owner, remediate the exposure, and verify with a re-scan."


def _preview_risk(name: str, severity: str, affected_assets: int, action: str) -> dict:
    return {
        "name": name,
        "severity": severity,
        "score": _severity_score(severity),
        "affected_assets": affected_assets,
        "finding_ids": [],
        "asset_ids": [],
        "reason": f"Deterministic preview data indicates this exposure on {affected_assets} asset(s).",
        "recommended_action": action,
    }


def _hostname_from_finding_host(value: str) -> str:
    parsed = urlparse(value)
    if not parsed.hostname:
        return value.lower()
    if parsed.port:
        return f"{parsed.hostname}:{parsed.port}".lower()
    return parsed.hostname.lower()


def _normalize_severity(value: str) -> str:
    normalized = value.lower()
    return normalized if normalized in SEVERITY_ORDER else "info"


def _is_site_preview_report(findings: list[Finding]) -> bool:
    return bool(findings) and all((finding.raw_json or {}).get("site_preview") is True for finding in findings)


def _run_lab_mode_pipeline(scan: Scan, db: Session, settings: Settings, target: str) -> None:
    response = _run_tracked_stage(
        scan,
        db,
        "lab_fetch",
        "safe-http",
        lambda: _fetch_lab_target(target, timeout=settings.scanner_timeout_seconds),
        target_count=1,
    )
    asset = Asset(
        scan_id=scan.id,
        hostname=target,
        ip=response.ip,
        is_alive=True,
        http_status=response.status_code,
        title=response.title,
        technologies=_infer_lab_technologies(target, response.headers),
    )
    db.add(asset)
    db.flush()

    finding = _build_lab_finding(scan.id, asset.id, target, response)
    findings: list[Finding] = []
    if finding is not None:
        db.add(finding)
        findings.append(finding)

    db.flush()
    report = _run_tracked_stage(
        scan,
        db,
        "reporting",
        "spectrascope",
        lambda: _build_lab_report(scan, target, findings, response),
        target_count=1,
    )
    db.add(report)


class _LabHttpResponse:
    def __init__(
        self,
        *,
        status_code: int,
        headers: dict[str, str],
        body: str,
        title: str | None,
        ip: str | None,
    ) -> None:
        self.status_code = status_code
        self.headers = headers
        self.body = body
        self.title = title
        self.ip = ip


def _fetch_lab_target(target: str, timeout: int) -> _LabHttpResponse:
    host, port = split_target_host_port(target)
    url = f"http://{host}:{port or 80}/"
    request = Request(
        url,
        headers={
            "Host": host,
            "User-Agent": "SpectraScope-LAB_MODE/1.0",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body_bytes = response.read()
            headers = {key.lower(): value for key, value in response.headers.items()}
            body = body_bytes.decode("utf-8", errors="replace")
            return _LabHttpResponse(
                status_code=response.getcode(),
                headers=headers,
                body=body,
                title=_extract_html_title(body),
                ip=response.headers.get("X-Forwarded-For"),
            )
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        headers = {key.lower(): value for key, value in exc.headers.items()}
        return _LabHttpResponse(
            status_code=exc.code,
            headers=headers,
            body=body,
            title=_extract_html_title(body),
            ip=None,
        )
    except URLError as exc:
        raise RuntimeError(f"LAB_MODE target {target} is unreachable: {exc.reason}") from exc


def _extract_html_title(body: str) -> str | None:
    match = TITLE_RE.search(body)
    if not match:
        return None
    return unescape(match.group(1).strip()) or None


def _infer_lab_technologies(target: str, headers: dict[str, str]) -> list[str]:
    tech: list[str] = ["lab-mode"]
    server = headers.get("server", "").lower()
    if "nginx" in server:
        tech.append("nginx")
    if "apache" in server:
        tech.append("apache")
    if target.startswith(("admin.", "legacy.")):
        tech.append("flask")
    return tech


def _build_lab_finding(scan_id: str, asset_id: str, target: str, response: _LabHttpResponse) -> Finding | None:
    definition = LAB_FINDING_DEFINITIONS.get(target)
    if definition is None:
        return None

    marker = response.headers.get("x-spectra-finding", "").lower()
    body_lower = response.body.lower()
    target_key = target.split(":", 1)[0]
    matched = False
    if target_key == "admin.lab.local":
        matched = marker == "exposed-admin-panel" or "internal administration portal" in body_lower
    elif target_key == "legacy.lab.local":
        matched = marker == "legacy-service" or "apache/2.4.49" in response.headers.get("server", "").lower()
    elif target_key == "files.lab.local":
        matched = "backup.zip" in body_lower and "config.old" in body_lower

    if not matched:
        return None

    return Finding(
        scan_id=scan_id,
        asset_id=asset_id,
        source_tool="lab-mode",
        template_id=definition["template_id"],
        name=definition["name"],
        severity=definition["severity"],
        description=definition["description"],
        matched_at=f"http://{target}/",
        raw_json={
            "lab_mode": True,
            "headers": response.headers,
            "status_code": response.status_code,
        },
    )


def _build_lab_report(scan: Scan, target: str, findings: list[Finding], response: _LabHttpResponse) -> RiskReport:
    recommendations = [
        "Keep LAB_MODE targets limited to the approved demo services only.",
        "Use the LAB_MODE findings as a regression signal for the demo loop, not as production evidence.",
    ]
    top_risks: list[dict] = []
    summary = (
        f"LAB_MODE scan for {target} completed with HTTP {response.status_code} "
        f"and {len(findings)} expected demo finding(s)."
    )
    if findings:
        definition = LAB_FINDING_DEFINITIONS.get(target)
        if definition is not None:
            recommendations = definition["recommendations"] + recommendations
        top_risks = [
            {
                "name": finding.name,
                "severity": finding.severity,
                "score": finding.cvss or _severity_score(finding.severity),
                "affected_assets": 1,
                "source_tool": finding.source_tool,
                "template_id": finding.template_id,
                "finding_ids": [finding.id] if finding.id else [],
                "asset_ids": [finding.asset_id] if finding.asset_id else [],
                "matched_at": finding.matched_at,
                "reason": "The expected local lab marker was confirmed on a reachable test asset.",
                "recommended_action": definition["recommendations"][0] if definition else recommendations[0],
            }
            for finding in findings
        ]
        summary = (
            f"LAB_MODE scan for {target} confirmed {findings[0].name} on a reachable demo service. "
            "This verifies the SpectraScope demo pipeline against the local lab target."
        )

    return RiskReport(
        scan_id=scan.id,
        summary=summary,
        top_risks=top_risks,
        recommendations=recommendations,
    )
