from datetime import datetime, timedelta
import csv
from html import escape
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.errors import ApiProblem
from app.core.config import Settings, get_settings
from app.core.metrics import SCANS_BY_STATUS, SCANS_STARTED_TOTAL
from app.db.session import get_db
from app.models import Asset, Finding, Operation, RiskReport, Scan, ScanAuditLog
from app.schemas.scan import (
    AssetListResponse,
    FindingListResponse,
    FindingResponse,
    FindingTriageRequest,
    RiskReportResponse,
    ScanAuditLogResponse,
    ScanListResponse,
    ScanResponse,
    ScanStartRequest,
)
from app.services.scan_profiles import ScanProfileError, validate_scan_profile_for_settings
from app.services.target_policy import TargetPolicyError, authorize_target
from app.services.workspace_settings import effective_settings
from app.services.network_policy import NetworkPolicyError, validate_external_network_targets
from app.workers.tasks import run_scan

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("/start", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
def start_scan(
    payload: ScanStartRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Scan:
    settings = effective_settings(db, settings)
    try:
        decision = authorize_target(payload.target, payload.confirm_authorized, settings)
        scan_profile = validate_scan_profile_for_settings(payload.scan_profile, settings)
        validate_external_network_targets([decision.target], settings)
    except (TargetPolicyError, ScanProfileError, NetworkPolicyError) as exc:
        _write_audit_log(db, scan_id=None, target=payload.target, decision="denied", reason=str(exc))
        db.commit()
        raise ApiProblem(
            status.HTTP_400_BAD_REQUEST,
            "TARGET_OR_PROFILE_INVALID",
            str(exc),
        ) from exc

    _expire_stale_scans(db, settings.scan_stale_after_seconds, target=decision.target)

    active_scan = db.scalar(
        select(Scan)
        .where(Scan.target == decision.target)
        .where(Scan.status.in_(["created", "running"]))
        .order_by(Scan.created_at.desc())
    )
    if active_scan is not None:
        _write_audit_log(
            db,
            scan_id=active_scan.id,
            target=decision.target,
            decision="denied",
            reason="An active scan for this target already exists",
        )
        db.commit()
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "ACTIVE_SCAN_EXISTS",
            "An active scan for this target already exists",
            {"scan_id": active_scan.id},
        )

    scan = Scan(target=decision.target, scan_profile=scan_profile, status="created")
    db.add(scan)
    db.flush()
    _write_audit_log(db, scan_id=scan.id, target=scan.target, decision="allowed", reason=decision.reason)
    db.commit()
    db.refresh(scan)
    SCANS_STARTED_TOTAL.labels(scan_profile=scan.scan_profile).inc()
    run_scan.delay(scan.id)
    return scan


@router.get("", response_model=ScanListResponse)
def list_scans(
    status_filter: str | None = Query(default=None, alias="status"),
    target_contains: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ScanListResponse:
    _expire_stale_scans(db, settings.scan_stale_after_seconds)
    query = select(Scan)
    count_query = select(func.count()).select_from(Scan)
    if status_filter:
        query = query.where(Scan.status == status_filter)
        count_query = count_query.where(Scan.status == status_filter)
    if target_contains:
        pattern = f"%{target_contains.lower()}%"
        query = query.where(Scan.target.ilike(pattern))
        count_query = count_query.where(Scan.target.ilike(pattern))

    total = db.scalar(count_query) or 0
    scans = list(db.scalars(query.order_by(Scan.created_at.desc()).limit(limit).offset(offset)))
    _refresh_scan_status_metrics(db)
    return ScanListResponse(total=total, limit=limit, offset=offset, items=scans)


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db)) -> Scan:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Scan not found")
    return scan


@router.post("/{scan_id}/cancel", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
def cancel_scan(scan_id: UUID, db: Session = Depends(get_db)) -> Scan:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Scan not found")
    if scan.status not in {"created", "running"}:
        raise ApiProblem(status.HTTP_409_CONFLICT, "SCAN_NOT_ACTIVE", "Only active scans can be cancelled")

    scan.cancellation_requested = True
    scan.current_stage = "cancelling"
    if scan.status == "created":
        scan.status = "cancelled"
        scan.current_stage = "cancelled"
        scan.finished_at = datetime.utcnow()
    _write_audit_log(
        db,
        scan_id=scan.id,
        target=scan.target,
        decision="allowed",
        reason="Scan cancellation requested",
        action="scan.cancel",
    )
    db.commit()
    db.refresh(scan)
    return scan


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(scan_id: UUID, db: Session = Depends(get_db)) -> Response:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Scan not found")
    if scan.status in {"created", "running"}:
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "ACTIVE_SCAN_DELETE_FORBIDDEN",
            "Cancel an active scan before deleting it",
            {"scan_id": scan.id},
        )

    active_operation = db.scalar(
        select(Operation)
        .where(Operation.scan_id == scan.id)
        .where(Operation.status.in_(["ready", "running", "awaiting_approval"]))
    )
    if active_operation is not None:
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "ACTIVE_OPERATION_DELETE_FORBIDDEN",
            "Abort or complete the active operation before deleting its source scan",
            {"operation_id": active_operation.id},
        )

    target = scan.target
    db.execute(
        update(ScanAuditLog)
        .where(ScanAuditLog.scan_id == scan.id)
        .values(scan_id=None)
    )
    db.execute(update(Operation).where(Operation.scan_id == scan.id).values(scan_id=None))
    db.delete(scan)
    _write_audit_log(
        db,
        scan_id=None,
        target=target,
        decision="allowed",
        reason=f"Deleted terminal scan {scan.id}",
        action="scan.delete",
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{scan_id}/assets", response_model=AssetListResponse)
def get_scan_assets(
    scan_id: UUID,
    hostname_contains: str | None = None,
    is_alive: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AssetListResponse:
    _ensure_scan_exists(db, scan_id)
    query = select(Asset).where(Asset.scan_id == str(scan_id))
    count_query = select(func.count()).select_from(Asset).where(Asset.scan_id == str(scan_id))
    if hostname_contains:
        pattern = f"%{hostname_contains.lower()}%"
        query = query.where(Asset.hostname.ilike(pattern))
        count_query = count_query.where(Asset.hostname.ilike(pattern))
    if is_alive is not None:
        query = query.where(Asset.is_alive == is_alive)
        count_query = count_query.where(Asset.is_alive == is_alive)

    total = db.scalar(count_query) or 0
    assets = list(db.scalars(query.order_by(Asset.created_at).limit(limit).offset(offset)))
    return AssetListResponse(total=total, limit=limit, offset=offset, items=assets)


@router.get("/{scan_id}/findings", response_model=FindingListResponse)
def get_scan_findings(
    scan_id: UUID,
    severity: str | None = None,
    source_tool: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> FindingListResponse:
    _ensure_scan_exists(db, scan_id)
    query = select(Finding).where(Finding.scan_id == str(scan_id))
    count_query = select(func.count()).select_from(Finding).where(Finding.scan_id == str(scan_id))
    if severity:
        query = query.where(Finding.severity == severity.lower())
        count_query = count_query.where(Finding.severity == severity.lower())
    if source_tool:
        query = query.where(Finding.source_tool == source_tool)
        count_query = count_query.where(Finding.source_tool == source_tool)

    total = db.scalar(count_query) or 0
    findings = list(db.scalars(query.order_by(Finding.created_at).limit(limit).offset(offset)))
    return FindingListResponse(total=total, limit=limit, offset=offset, items=findings)


@router.patch("/{scan_id}/findings/{finding_id}", response_model=FindingResponse)
def triage_finding(
    scan_id: UUID,
    finding_id: UUID,
    payload: FindingTriageRequest,
    db: Session = Depends(get_db),
) -> Finding:
    _ensure_scan_exists(db, scan_id)
    finding = db.get(Finding, str(finding_id))
    if finding is None or finding.scan_id != str(scan_id):
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "FINDING_NOT_FOUND", "Finding not found")
    finding.triage_status = payload.status
    finding.assigned_to = payload.assigned_to.strip() if payload.assigned_to else None
    finding.triage_note = payload.note.strip() if payload.note else None
    finding.updated_at = datetime.utcnow()
    db.add(ScanAuditLog(
        scan_id=str(scan_id),
        action="finding.triage",
        target=db.get(Scan, str(scan_id)).target,
        decision="allowed",
        reason=f"Finding {finding.id} moved to {payload.status}",
        metadata_json={"finding_id": finding.id, "status": payload.status},
    ))
    db.commit()
    db.refresh(finding)
    return finding


@router.get("/{scan_id}/report", response_model=RiskReportResponse)
def get_scan_report(scan_id: UUID, db: Session = Depends(get_db)) -> RiskReport:
    _ensure_scan_exists(db, scan_id)
    report = db.scalar(select(RiskReport).where(RiskReport.scan_id == str(scan_id)))
    if report is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "REPORT_NOT_FOUND", "Report not found")
    return report


@router.get("/{scan_id}/report/export")
def export_scan_report(
    scan_id: UUID,
    export_format: str = Query(default="html", alias="format", pattern="^(html|csv|sarif)$"),
    db: Session = Depends(get_db),
) -> Response:
    scan = _ensure_scan_exists(db, scan_id)
    report = db.scalar(select(RiskReport).where(RiskReport.scan_id == str(scan_id)))
    if report is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "REPORT_NOT_FOUND", "Report not found")
    findings = list(
        db.scalars(select(Finding).where(Finding.scan_id == str(scan_id)).order_by(Finding.created_at))
    )
    safe_target = "".join(char if char.isalnum() or char in ".-_" else "-" for char in scan.target)
    if export_format == "csv":
        content = _report_csv(findings)
        media_type = "text/csv"
        extension = "csv"
    elif export_format == "sarif":
        content = json.dumps(_report_sarif(scan.target, findings), indent=2)
        media_type = "application/sarif+json"
        extension = "sarif.json"
    else:
        content = _report_html(scan, report, findings)
        media_type = "text/html"
        extension = "html"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="spectrascope-{safe_target}.{extension}"'},
    )


@router.get("/{scan_id}/audit", response_model=list[ScanAuditLogResponse])
def get_scan_audit(scan_id: UUID, db: Session = Depends(get_db)) -> list[ScanAuditLog]:
    _ensure_scan_exists(db, scan_id)
    return list(
        db.scalars(
            select(ScanAuditLog)
            .where(ScanAuditLog.scan_id == str(scan_id))
            .order_by(ScanAuditLog.created_at.desc())
        )
    )


def _ensure_scan_exists(db: Session, scan_id: UUID) -> Scan:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Scan not found")
    return scan


def _report_csv(findings: list[Finding]) -> str:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["severity", "name", "source_tool", "template_id", "cve", "cvss", "matched_at"])
    for finding in findings:
        writer.writerow([
            finding.severity,
            finding.name,
            finding.source_tool,
            finding.template_id or "",
            finding.cve or "",
            finding.cvss if finding.cvss is not None else "",
            finding.matched_at or "",
        ])
    return stream.getvalue()


def _report_sarif(target: str, findings: list[Finding]) -> dict:
    rules = {}
    results = []
    level = {"critical": "error", "high": "error", "medium": "warning", "low": "note", "info": "note"}
    for finding in findings:
        rule_id = finding.template_id or f"{finding.source_tool}:{finding.name}"
        rules.setdefault(
            rule_id,
            {
                "id": rule_id,
                "name": finding.name,
                "shortDescription": {"text": finding.description or finding.name},
                "properties": {"severity": finding.severity, "sourceTool": finding.source_tool},
            },
        )
        result = {
            "ruleId": rule_id,
            "level": level.get(finding.severity, "note"),
            "message": {"text": finding.description or finding.name},
        }
        if finding.matched_at:
            result["locations"] = [{"physicalLocation": {"artifactLocation": {"uri": finding.matched_at}}}]
        results.append(result)
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {"name": "SpectraScope", "version": "1.0.0", "rules": list(rules.values())}},
            "automationDetails": {"description": {"text": f"Authorized scan of {target}"}},
            "results": results,
        }],
    }


def _report_html(scan: Scan, report: RiskReport, findings: list[Finding]) -> str:
    risk_rows = "".join(
        f"<tr><td>{escape(str(item.get('severity', 'info')))}</td><td>{escape(str(item.get('name') or item.get('risk') or 'Risk'))}</td><td>{escape(str(item.get('score', '')))}</td></tr>"
        for item in report.top_risks
    )
    finding_rows = "".join(
        f"<tr><td>{escape(item.severity)}</td><td>{escape(item.name)}</td><td>{escape(item.source_tool)}</td><td>{escape(item.matched_at or '')}</td></tr>"
        for item in findings
    )
    recommendations = "".join(f"<li>{escape(item)}</li>" for item in report.recommendations)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>SpectraScope report — {escape(scan.target)}</title>
<style>body{{font:14px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#172033}}h1,h2{{color:#09152f}}.meta{{color:#52617a}}table{{width:100%;border-collapse:collapse;margin:16px 0 28px}}th,td{{padding:9px;border:1px solid #d9dfeb;text-align:left}}th{{background:#eef3fb}}@media print{{body{{margin:0}}}}</style></head>
<body><p class="meta">SpectraScope 1.0 · authorized defensive assessment</p><h1>{escape(scan.target)}</h1>
<p class="meta">Scan {escape(scan.id)} · profile {escape(scan.scan_profile)} · created {escape(scan.created_at.isoformat())}</p>
<h2>Executive summary</h2><p>{escape(report.summary)}</p><h2>Top risks</h2><table><tr><th>Severity</th><th>Risk</th><th>Score</th></tr>{risk_rows}</table>
<h2>Findings</h2><table><tr><th>Severity</th><th>Name</th><th>Source</th><th>Location</th></tr>{finding_rows}</table>
<h2>Recommendations</h2><ol>{recommendations}</ol><p class="meta">Generated {escape(datetime.utcnow().isoformat())} UTC. Scanner observations require human validation.</p></body></html>"""


def _write_audit_log(
    db: Session,
    scan_id: str | None,
    target: str,
    decision: str,
    reason: str | None,
    action: str = "scan.start",
) -> None:
    db.add(
        ScanAuditLog(
            scan_id=scan_id,
            action=action,
            target=target,
            decision=decision,
            reason=reason,
            metadata_json={"source": "api"},
        )
    )


def _expire_stale_scans(db: Session, stale_after_seconds: int, target: str | None = None) -> int:
    cutoff = datetime.utcnow() - timedelta(seconds=stale_after_seconds)
    query = select(Scan).where(Scan.status.in_(["created", "running"]))
    if target is not None:
        query = query.where(Scan.target == target)

    expired = 0
    for scan in db.scalars(query):
        reference = scan.started_at or scan.created_at
        if reference > cutoff:
            continue

        scan.status = "failed"
        scan.current_stage = "stale"
        scan.finished_at = datetime.utcnow()
        scan.error_message = (
            f"Scan exceeded the {stale_after_seconds}-second active lifetime and was released as stale"
        )
        diagnostics = [dict(item) for item in (scan.stage_diagnostics or [])]
        for diagnostic in diagnostics:
            if diagnostic.get("status") == "running":
                diagnostic["status"] = "failed"
                diagnostic["finished_at"] = scan.finished_at.isoformat()
                diagnostic["error"] = "Stage was released after the scan became stale"
        scan.stage_diagnostics = diagnostics
        _write_audit_log(
            db,
            scan_id=scan.id,
            target=scan.target,
            decision="allowed",
            reason=scan.error_message,
            action="scan.expire_stale",
        )
        expired += 1

    if expired:
        db.commit()
    return expired


def _refresh_scan_status_metrics(db: Session) -> None:
    counts = dict(db.execute(select(Scan.status, func.count()).group_by(Scan.status)).all())
    for status_name in ["created", "running", "completed", "failed", "cancelled"]:
        SCANS_BY_STATUS.labels(status=status_name).set(counts.get(status_name, 0))
