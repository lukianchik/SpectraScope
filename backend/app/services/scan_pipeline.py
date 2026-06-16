from __future__ import annotations

import logging
import re
import time
from collections import Counter
from datetime import datetime
from html import unescape
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
from app.services.target_validation import normalize_target, split_target_host_port

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1}
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
SUPPORTED_SCAN_PROFILES = {"discovery", "safe", "lab"}

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
        scan.assets.clear()
        scan.findings.clear()
        if scan.report is not None:
            db.delete(scan.report)
            scan.report = None
        db.commit()

        target = normalize_target(scan.target)
        scan_profile = scan.scan_profile or "safe"
        if scan_profile not in SUPPORTED_SCAN_PROFILES:
            raise ValueError(f"Unsupported scan_profile '{scan_profile}'")

        logger.info(
            "Starting scan pipeline scan_id=%s target=%s profile=%s real_scanners=%s",
            scan_id,
            target,
            scan_profile,
            settings.enable_real_scanners,
        )

        if settings.lab_mode:
            if scan_profile != "lab":
                raise ValueError("LAB_MODE scans require scan_profile='lab'")
            _run_lab_mode_pipeline(scan, db, settings, target)
            scan.status = "completed"
            scan.finished_at = datetime.utcnow()
            db.commit()
            SCANS_COMPLETED_TOTAL.inc()
            SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
            logger.info("Completed LAB_MODE scan pipeline scan_id=%s findings=%s", scan_id, len(scan.findings))
            return

        if scan_profile == "lab":
            raise ValueError("scan_profile='lab' requires LAB_MODE=true")

        logger.info("Scan stage=discovery scan_id=%s target=%s", scan_id, target)
        subdomains = SubfinderAdapter(settings).discover(target)
        hostnames = list(dict.fromkeys(result.hostname for result in subdomains))
        if settings.enable_real_scanners and target not in hostnames:
            hostnames.insert(0, target)

        logger.info("Scan stage=probing scan_id=%s hostnames=%s", scan_id, len(hostnames))
        alive_results = HttpxAdapter(settings).probe(hostnames)
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

        if scan_profile == "safe":
            logger.info("Scan stage=nuclei scan_id=%s urls=%s", scan_id, len(alive_results))
            urls = [result.url for result in alive_results if result.url]
            nuclei_findings = NucleiAdapter(settings).scan(urls)
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

            logger.info("Scan stage=services scan_id=%s hosts=%s", scan_id, len(assets_by_hostname))
            service_results = NmapAdapter(settings).scan_services(list(assets_by_hostname))
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
        logger.info("Scan stage=reporting scan_id=%s", scan_id)
        report = build_risk_report(scan, list(scan.findings), len(assets_by_hostname))
        db.add(report)

        scan.status = "completed"
        scan.finished_at = datetime.utcnow()
        db.commit()
        SCANS_COMPLETED_TOTAL.inc()
        SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
        logger.info("Completed scan pipeline scan_id=%s assets=%s findings=%s", scan_id, len(assets_by_hostname), len(scan.findings))
    except Exception as exc:
        logger.exception("Scan pipeline failed scan_id=%s", scan_id)
        db.rollback()
        failed_scan = db.get(Scan, scan_id)
        if failed_scan is not None:
            failed_scan.status = "failed"
            failed_scan.finished_at = datetime.utcnow()
            failed_scan.error_message = str(exc)
            db.commit()
        SCANS_FAILED_TOTAL.inc()
        SCAN_PIPELINE_DURATION_SECONDS.observe(time.perf_counter() - started_at_monotonic)
        raise


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
                {"risk": "Exposed Admin Panel", "assets": 1, "severity": "high"},
                {"risk": "Missing Security Headers", "assets": 8, "severity": "medium"},
                {"risk": "Directory Listing Enabled", "assets": 2, "severity": "medium"},
                {"risk": "Outdated Server Version", "assets": 3, "severity": "medium"},
                {"risk": "TLS Certificate Expiring Soon", "assets": 2, "severity": "low"},
            ],
            recommendations=[
                f"Secure or remove the exposed admin panel on admin.{scan.target}.",
                "Implement security headers (CSP, HSTS, X-Frame-Options) across all web assets.",
                "Update outdated software and re-scan to verify remediation.",
            ],
        )

    severity_counts = Counter(finding.severity for finding in findings)
    top_findings = sorted(findings, key=lambda item: SEVERITY_ORDER.get(item.severity, 0), reverse=True)[:5]
    top_risks = [
        {
            "name": finding.name,
            "severity": finding.severity,
            "source_tool": finding.source_tool,
            "template_id": finding.template_id,
            "cve": finding.cve,
        }
        for finding in top_findings
    ]
    risk_score = sum(SEVERITY_ORDER.get(finding.severity, 0) for finding in findings)
    summary = (
        f"Scan for {scan.target} discovered {asset_count} alive asset(s) and {len(findings)} finding(s). "
        f"Calculated baseline risk score: {risk_score}. "
        "This report is generated from a safe MVP pipeline and is not evidence of exploitation."
    )
    recommendations = [
        "Review externally exposed assets and confirm they are expected.",
        "Prioritize critical and high severity findings before lower severity observations.",
        "Validate findings manually before making risk decisions.",
    ]
    if severity_counts.get("critical") or severity_counts.get("high"):
        recommendations.insert(0, "Investigate high-impact findings with the responsible asset owners.")

    return RiskReport(
        scan_id=scan.id,
        summary=summary,
        top_risks=top_risks,
        recommendations=recommendations,
    )


def _hostname_from_finding_host(value: str) -> str:
    parsed = urlparse(value)
    return (parsed.hostname or value).lower()


def _normalize_severity(value: str) -> str:
    normalized = value.lower()
    return normalized if normalized in SEVERITY_ORDER else "info"


def _is_site_preview_report(findings: list[Finding]) -> bool:
    return bool(findings) and all((finding.raw_json or {}).get("site_preview") is True for finding in findings)


def _run_lab_mode_pipeline(scan: Scan, db: Session, settings: Settings, target: str) -> None:
    response = _fetch_lab_target(target, timeout=settings.scanner_timeout_seconds)
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
    db.add(_build_lab_report(scan, target, findings, response))


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
        top_risks = [{"risk": finding.name, "assets": 1, "severity": finding.severity} for finding in findings]
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
