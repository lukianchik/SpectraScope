from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import Asset, Finding, RiskReport, Scan, ScanAuditLog
from app.schemas.scan import (
    AssetListResponse,
    FindingListResponse,
    RiskReportResponse,
    ScanAuditLogResponse,
    ScanListResponse,
    ScanResponse,
    ScanStartRequest,
)
from app.services.target_policy import TargetPolicyError, authorize_target
from app.workers.tasks import run_scan

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("/start", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
def start_scan(
    payload: ScanStartRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Scan:
    try:
        decision = authorize_target(payload.target, payload.confirm_authorized, settings)
    except TargetPolicyError as exc:
        _write_audit_log(db, scan_id=None, target=payload.target, decision="denied", reason=str(exc))
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "An active scan for this target already exists", "scan_id": active_scan.id},
        )

    scan = Scan(target=decision.target, scan_profile=payload.scan_profile, status="created")
    db.add(scan)
    db.flush()
    _write_audit_log(db, scan_id=scan.id, target=scan.target, decision="allowed", reason=decision.reason)
    db.commit()
    db.refresh(scan)
    run_scan.delay(scan.id)
    return scan


@router.get("", response_model=ScanListResponse)
def list_scans(
    status_filter: str | None = Query(default=None, alias="status"),
    target_contains: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ScanListResponse:
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
    return ScanListResponse(total=total, limit=limit, offset=offset, items=scans)


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db)) -> Scan:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


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


@router.get("/{scan_id}/report", response_model=RiskReportResponse)
def get_scan_report(scan_id: UUID, db: Session = Depends(get_db)) -> RiskReport:
    _ensure_scan_exists(db, scan_id)
    report = db.scalar(select(RiskReport).where(RiskReport.scan_id == str(scan_id)))
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


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


def _ensure_scan_exists(db: Session, scan_id: UUID) -> None:
    if db.get(Scan, str(scan_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")


def _write_audit_log(db: Session, scan_id: str | None, target: str, decision: str, reason: str | None) -> None:
    db.add(
        ScanAuditLog(
            scan_id=scan_id,
            action="scan.start",
            target=target,
            decision=decision,
            reason=reason,
            metadata_json={"source": "api"},
        )
    )
