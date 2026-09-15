from datetime import datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.errors import ApiProblem
from app.api.operations import create_operation, transition_operation
from app.api.scans import delete_scan
from app.db.base import Base
from app.models import Scan
from app.schemas.operation import OperationCreateRequest, OperationTransitionRequest


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def completed_scan(db: Session) -> Scan:
    scan = Scan(
        target="perimeter.lab.local:8088",
        status="completed",
        scan_profile="local-real",
    )
    db.add(scan)
    db.commit()
    return scan


def test_operation_scope_is_derived_from_completed_scan(db: Session) -> None:
    scan = completed_scan(db)

    operation = create_operation(
        OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
        db,
    )

    assert operation.status == "ready"
    assert operation.target == scan.target
    assert operation.scope_manifest["allowed_targets"] == [scan.target]
    assert operation.scope_manifest["active_actions"] is False
    assert operation.scope_manifest["simulation_only"] is True
    assert len(operation.events) == 1
    assert operation.events[0].event_type == "system"


def test_operation_requires_authorization_and_completed_scan(db: Session) -> None:
    scan = completed_scan(db)

    with pytest.raises(ApiProblem) as missing_confirmation:
        create_operation(
            OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=False),
            db,
        )
    assert missing_confirmation.value.code == "OPERATION_AUTHORIZATION_REQUIRED"

    scan.status = "running"
    db.commit()
    with pytest.raises(ApiProblem) as incomplete:
        create_operation(
            OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
            db,
        )
    assert incomplete.value.code == "SCAN_NOT_COMPLETED"


def test_operation_enforces_order_and_human_gate(db: Session) -> None:
    scan = completed_scan(db)
    operation = create_operation(
        OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
        db,
    )
    operation_id = UUID(operation.id)

    with pytest.raises(ApiProblem) as skipped:
        transition_operation(
            operation_id,
            OperationTransitionRequest(action="approve_path", confirm_human=True),
            db,
        )
    assert skipped.value.code == "INVALID_OPERATION_TRANSITION"

    operation = transition_operation(
        operation_id,
        OperationTransitionRequest(action="start"),
        db,
    )
    assert (operation.status, operation.current_phase) == ("running", "evidence_ingest")

    operation = transition_operation(
        operation_id,
        OperationTransitionRequest(action="map_surface"),
        db,
    )
    assert operation.current_phase == "surface_mapping"

    operation = transition_operation(
        operation_id,
        OperationTransitionRequest(action="correlate_exposure"),
        db,
    )
    assert (operation.status, operation.current_phase) == (
        "awaiting_approval",
        "exposure_correlation",
    )

    with pytest.raises(ApiProblem) as missing_human:
        transition_operation(
            operation_id,
            OperationTransitionRequest(action="approve_path"),
            db,
        )
    assert missing_human.value.code == "HUMAN_CONFIRMATION_REQUIRED"

    operation = transition_operation(
        operation_id,
        OperationTransitionRequest(action="approve_path", confirm_human=True),
        db,
    )
    assert (operation.status, operation.current_phase) == ("running", "path_simulation")
    assert any(event.decision == "denied" for event in operation.events)
    assert any(event.decision == "approved" for event in operation.events)

    operation = transition_operation(
        operation_id,
        OperationTransitionRequest(action="complete"),
        db,
    )
    assert (operation.status, operation.current_phase) == ("completed", "defensive_synthesis")
    assert operation.completed_at is not None
    assert [event.sequence for event in operation.events] == list(range(1, len(operation.events) + 1))

    with pytest.raises(ApiProblem) as terminal:
        transition_operation(
            operation_id,
            OperationTransitionRequest(action="abort"),
            db,
        )
    assert terminal.value.code == "OPERATION_TERMINAL"


def test_operation_can_be_aborted_before_completion(db: Session) -> None:
    scan = completed_scan(db)
    operation = create_operation(
        OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
        db,
    )

    operation = transition_operation(
        UUID(operation.id),
        OperationTransitionRequest(action="abort"),
        db,
    )

    assert operation.status == "aborted"
    assert operation.completed_at is not None
    assert operation.events[-1].decision == "aborted"


def test_expired_scope_stops_operation(db: Session) -> None:
    scan = completed_scan(db)
    operation = create_operation(
        OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
        db,
    )
    manifest = dict(operation.scope_manifest)
    manifest["expires_at"] = (datetime.utcnow() - timedelta(minutes=1)).isoformat()
    operation.scope_manifest = manifest
    db.commit()

    with pytest.raises(ApiProblem) as expired:
        transition_operation(
            UUID(operation.id),
            OperationTransitionRequest(action="start"),
            db,
        )

    assert expired.value.code == "OPERATION_SCOPE_EXPIRED"
    db.refresh(operation)
    assert operation.status == "aborted"
    assert operation.events[-1].decision == "denied"


def test_scan_delete_requires_terminal_operation_and_preserves_it(db: Session) -> None:
    scan = completed_scan(db)
    operation = create_operation(
        OperationCreateRequest(scan_id=UUID(scan.id), confirm_authorized=True),
        db,
    )

    with pytest.raises(ApiProblem) as active:
        delete_scan(UUID(scan.id), db)
    assert active.value.code == "ACTIVE_OPERATION_DELETE_FORBIDDEN"

    operation = transition_operation(
        UUID(operation.id),
        OperationTransitionRequest(action="abort"),
        db,
    )
    response = delete_scan(UUID(scan.id), db)

    assert response.status_code == 204
    db.refresh(operation)
    assert operation.scan_id is None
    assert operation.target == "perimeter.lab.local:8088"
