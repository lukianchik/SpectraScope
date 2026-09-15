from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.errors import ApiProblem
from app.db.session import get_db
from app.models import Operation, OperationEvent, Scan, ScanAuditLog
from app.schemas.operation import (
    OperationCreateRequest,
    OperationListResponse,
    OperationResponse,
    OperationTransitionRequest,
)


router = APIRouter(prefix="/api/operations", tags=["operations"])

ACTIVE_STATUSES = {"ready", "running", "awaiting_approval"}
TRANSITIONS = {
    ("ready", "evidence_ingest", "start"): (
        "running",
        "evidence_ingest",
        "system",
        "Operation replay started from immutable scanner evidence.",
    ),
    ("running", "evidence_ingest", "map_surface"): (
        "running",
        "surface_mapping",
        "observed",
        "Observed assets placed on the operation topology.",
    ),
    ("running", "surface_mapping", "correlate_exposure"): (
        "awaiting_approval",
        "exposure_correlation",
        "observed",
        "Scanner findings correlated; operation paused for human approval.",
    ),
    ("awaiting_approval", "exposure_correlation", "approve_path"): (
        "running",
        "path_simulation",
        "human",
        "Operator approved non-executing path simulation.",
    ),
    ("running", "path_simulation", "complete"): (
        "completed",
        "defensive_synthesis",
        "system",
        "Operation simulation completed without active security actions.",
    ),
}


@router.post("", response_model=OperationResponse, status_code=status.HTTP_201_CREATED)
def create_operation(payload: OperationCreateRequest, db: Session = Depends(get_db)) -> Operation:
    scan = db.get(Scan, str(payload.scan_id))
    if scan is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Source scan not found")
    if not payload.confirm_authorized:
        _write_scan_audit(db, scan, "denied", "Explicit operation authorization is required")
        db.commit()
        raise ApiProblem(
            status.HTTP_400_BAD_REQUEST,
            "OPERATION_AUTHORIZATION_REQUIRED",
            "Confirm authorization before creating an operation",
        )
    if scan.status != "completed":
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "SCAN_NOT_COMPLETED",
            "Operations can only be created from a completed scan",
        )

    existing = db.scalar(
        select(Operation)
        .where(Operation.scan_id == scan.id)
        .where(Operation.status.in_(ACTIVE_STATUSES))
        .order_by(Operation.created_at.desc())
    )
    if existing is not None:
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "ACTIVE_OPERATION_EXISTS",
            "An active operation already exists for this scan",
            {"operation_id": existing.id},
        )

    operation = Operation(
        scan_id=scan.id,
        target=scan.target,
        status="ready",
        current_phase="evidence_ingest",
        scope_manifest={
            "allowed_targets": [scan.target],
            "source_scan_id": scan.id,
            "scan_profile": scan.scan_profile,
            "simulation_only": True,
            "active_actions": False,
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
        },
    )
    db.add(operation)
    db.flush()
    _append_event(
        db,
        operation,
        event_type="system",
        message="Controlled operation created with an exact target scope.",
        metadata={"allowed_targets": [scan.target], "active_actions": False},
    )
    _write_scan_audit(db, scan, "allowed", f"Created controlled operation {operation.id}")
    db.commit()
    db.refresh(operation)
    return operation


@router.get("", response_model=OperationListResponse)
def list_operations(
    scan_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> OperationListResponse:
    query = select(Operation)
    count_query = select(func.count()).select_from(Operation)
    if scan_id is not None:
        query = query.where(Operation.scan_id == str(scan_id))
        count_query = count_query.where(Operation.scan_id == str(scan_id))
    items = list(db.scalars(query.order_by(Operation.created_at.desc()).limit(limit)))
    return OperationListResponse(total=db.scalar(count_query) or 0, items=items)


@router.get("/{operation_id}", response_model=OperationResponse)
def get_operation(operation_id: UUID, db: Session = Depends(get_db)) -> Operation:
    return _get_operation(db, operation_id)


@router.post("/{operation_id}/transition", response_model=OperationResponse)
def transition_operation(
    operation_id: UUID,
    payload: OperationTransitionRequest,
    db: Session = Depends(get_db),
) -> Operation:
    operation = _get_operation(db, operation_id)
    if operation.status in {"completed", "aborted"}:
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "OPERATION_TERMINAL",
            "A terminal operation cannot transition",
        )

    if payload.action == "abort":
        operation.status = "aborted"
        operation.completed_at = datetime.utcnow()
        _append_event(
            db,
            operation,
            event_type="human",
            decision="aborted",
            message="Operation simulation aborted by operator.",
        )
        db.commit()
        db.refresh(operation)
        return operation

    expires_at = datetime.fromisoformat(str(operation.scope_manifest["expires_at"]))
    if expires_at <= datetime.utcnow():
        operation.status = "aborted"
        operation.completed_at = datetime.utcnow()
        _append_event(
            db,
            operation,
            event_type="system",
            decision="denied",
            message="Operation stopped because its exact scope manifest expired.",
        )
        db.commit()
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "OPERATION_SCOPE_EXPIRED",
            "The operation scope manifest has expired",
        )

    transition = TRANSITIONS.get((operation.status, operation.current_phase, payload.action))
    if transition is None:
        raise ApiProblem(
            status.HTTP_409_CONFLICT,
            "INVALID_OPERATION_TRANSITION",
            "The requested action is not valid for the current operation state",
            {
                "status": operation.status,
                "phase": operation.current_phase,
                "action": payload.action,
            },
        )

    if payload.action == "approve_path" and not payload.confirm_human:
        _append_event(
            db,
            operation,
            event_type="human",
            decision="denied",
            message="Path simulation approval rejected because human confirmation was absent.",
        )
        db.commit()
        raise ApiProblem(
            status.HTTP_400_BAD_REQUEST,
            "HUMAN_CONFIRMATION_REQUIRED",
            "Human confirmation is required before path simulation",
        )

    next_status, next_phase, event_type, message = transition
    operation.status = next_status
    operation.current_phase = next_phase
    operation.updated_at = datetime.utcnow()
    if next_status == "completed":
        operation.completed_at = datetime.utcnow()
    _append_event(
        db,
        operation,
        event_type=event_type,
        decision="approved" if payload.action == "approve_path" else None,
        message=message,
        metadata={"action": payload.action},
    )
    db.commit()
    db.refresh(operation)
    return operation


def _get_operation(db: Session, operation_id: UUID) -> Operation:
    operation = db.get(Operation, str(operation_id))
    if operation is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "OPERATION_NOT_FOUND", "Operation not found")
    return operation


def _append_event(
    db: Session,
    operation: Operation,
    event_type: str,
    message: str,
    decision: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        OperationEvent(
            operation_id=operation.id,
            sequence=len(operation.events) + 1,
            event_type=event_type,
            phase=operation.current_phase,
            decision=decision,
            message=message,
            metadata_json=metadata,
        )
    )


def _write_scan_audit(db: Session, scan: Scan, decision: str, reason: str) -> None:
    db.add(
        ScanAuditLog(
            scan_id=scan.id,
            action="operation.create",
            target=scan.target,
            decision=decision,
            reason=reason,
            metadata_json={"source": "api", "simulation_only": True},
        )
    )
