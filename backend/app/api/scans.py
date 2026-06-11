from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Asset, Finding, RiskReport, Scan
from app.schemas.scan import AssetResponse, FindingResponse, RiskReportResponse, ScanResponse, ScanStartRequest
from app.services.target_validation import TargetValidationError, normalize_target
from app.workers.tasks import run_scan

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("/start", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
def start_scan(payload: ScanStartRequest, db: Session = Depends(get_db)) -> Scan:
    try:
        target = normalize_target(payload.target)
    except TargetValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    scan = Scan(target=target, scan_profile=payload.scan_profile, status="created")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    run_scan.delay(scan.id)
    return scan


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db)) -> Scan:
    scan = db.get(Scan, str(scan_id))
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


@router.get("/{scan_id}/assets", response_model=list[AssetResponse])
def get_scan_assets(scan_id: UUID, db: Session = Depends(get_db)) -> list[Asset]:
    _ensure_scan_exists(db, scan_id)
    return list(db.scalars(select(Asset).where(Asset.scan_id == str(scan_id)).order_by(Asset.created_at)))


@router.get("/{scan_id}/findings", response_model=list[FindingResponse])
def get_scan_findings(scan_id: UUID, db: Session = Depends(get_db)) -> list[Finding]:
    _ensure_scan_exists(db, scan_id)
    return list(db.scalars(select(Finding).where(Finding.scan_id == str(scan_id)).order_by(Finding.created_at)))


@router.get("/{scan_id}/report", response_model=RiskReportResponse)
def get_scan_report(scan_id: UUID, db: Session = Depends(get_db)) -> RiskReport:
    _ensure_scan_exists(db, scan_id)
    report = db.scalar(select(RiskReport).where(RiskReport.scan_id == str(scan_id)))
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


def _ensure_scan_exists(db: Session, scan_id: UUID) -> None:
    if db.get(Scan, str(scan_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
