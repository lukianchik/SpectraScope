from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models import Asset, Finding, RiskReport, Scan, Service
from app.scanners.httpx import HttpxAdapter
from app.scanners.nmap import NmapAdapter
from app.scanners.nuclei import NucleiAdapter
from app.scanners.subfinder import SubfinderAdapter
from app.services.target_validation import normalize_target

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1}


def run_scan_pipeline(scan_id: str, db: Session, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise ValueError(f"Scan {scan_id} not found")

    try:
        scan.status = "running"
        scan.started_at = datetime.utcnow()
        scan.error_message = None
        db.commit()

        target = normalize_target(scan.target)
        logger.info("Starting safe scan pipeline for target=%s scan_id=%s", target, scan_id)

        subdomains = SubfinderAdapter(settings).discover(target)
        hostnames = sorted({result.hostname for result in subdomains})

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

        urls = [result.url for result in alive_results if result.url]
        nuclei_findings = NucleiAdapter(settings).scan(urls)
        for result in nuclei_findings:
            hostname = _hostname_from_finding_host(result.host)
            asset = assets_by_hostname.get(hostname)
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
        report = build_risk_report(scan, list(scan.findings), len(assets_by_hostname))
        db.add(report)

        scan.status = "completed"
        scan.finished_at = datetime.utcnow()
        db.commit()
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
        raise


def build_risk_report(scan: Scan, findings: list[Finding], asset_count: int) -> RiskReport:
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
