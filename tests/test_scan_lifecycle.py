from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.errors import ApiProblem
from app.api.scans import _expire_stale_scans, delete_scan
from app.db.base import Base
from app.models import Scan, ScanAuditLog


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


def test_stale_scan_is_released_and_diagnostic_is_closed(db: Session) -> None:
    scan = Scan(
        target="perimeter.lab.local:8088",
        status="running",
        scan_profile="local-real",
        created_at=datetime.utcnow() - timedelta(hours=2),
        started_at=datetime.utcnow() - timedelta(hours=2),
        stage_diagnostics=[{"stage": "probing", "status": "running", "error": None}],
    )
    db.add(scan)
    db.commit()

    assert _expire_stale_scans(db, stale_after_seconds=1800) == 1

    db.refresh(scan)
    assert scan.status == "failed"
    assert scan.current_stage == "stale"
    assert "released as stale" in (scan.error_message or "")
    assert scan.stage_diagnostics[0]["status"] == "failed"
    audit = db.scalar(select(ScanAuditLog).where(ScanAuditLog.scan_id == scan.id))
    assert audit is not None
    assert audit.action == "scan.expire_stale"


def test_terminal_scan_can_be_deleted_without_losing_audit_history(db: Session) -> None:
    scan = Scan(target="example.com", status="completed", scan_profile="safe")
    db.add(scan)
    db.flush()
    db.add(
        ScanAuditLog(
            scan_id=scan.id,
            action="scan.start",
            target=scan.target,
            decision="allowed",
        )
    )
    db.commit()
    scan_id = scan.id

    response = delete_scan(scan_id, db)

    assert response.status_code == 204
    assert db.get(Scan, scan_id) is None
    audit_entries = list(db.scalars(select(ScanAuditLog).order_by(ScanAuditLog.created_at)))
    assert len(audit_entries) == 2
    assert all(item.scan_id is None for item in audit_entries)
    assert audit_entries[-1].action == "scan.delete"


def test_active_scan_must_be_cancelled_before_delete(db: Session) -> None:
    scan = Scan(target="example.com", status="running", scan_profile="safe")
    db.add(scan)
    db.commit()

    with pytest.raises(ApiProblem) as raised:
        delete_scan(scan.id, db)

    assert raised.value.status_code == 409
    assert raised.value.code == "ACTIVE_SCAN_DELETE_FORBIDDEN"
