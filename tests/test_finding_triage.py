from uuid import UUID

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.scans import triage_finding
from app.db.base import Base
from app.models import Finding, Scan, ScanAuditLog
from app.schemas.scan import FindingTriageRequest


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


def test_finding_triage_is_persisted_and_audited(db: Session) -> None:
    scan = Scan(target="example.com", status="completed", scan_profile="safe")
    db.add(scan)
    db.flush()
    finding = Finding(
        scan_id=scan.id,
        source_tool="nuclei",
        name="Example finding",
        severity="medium",
    )
    db.add(finding)
    db.commit()

    updated = triage_finding(
        UUID(scan.id),
        UUID(finding.id),
        FindingTriageRequest(status="resolved", assigned_to="operator", note="Patched"),
        db,
    )

    assert updated.triage_status == "resolved"
    assert updated.assigned_to == "operator"
    assert updated.triage_note == "Patched"
    audit = db.scalar(select(ScanAuditLog).where(ScanAuditLog.action == "finding.triage"))
    assert audit is not None
    assert audit.metadata_json["status"] == "resolved"
