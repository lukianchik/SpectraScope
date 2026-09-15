import json
from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.scans import export_scan_report
from app.db.base import Base
from app.models import Finding, RiskReport, Scan


@pytest.fixture
def report_scan(db: Session) -> Scan:
    scan = Scan(target="example.com", status="completed", scan_profile="safe")
    db.add(scan)
    db.flush()
    db.add(Finding(
        scan_id=scan.id,
        source_tool="nuclei",
        template_id="missing-header",
        name="Missing Header",
        severity="low",
        description="A security header is missing.",
        matched_at="https://example.com",
    ))
    db.add(RiskReport(
        scan_id=scan.id,
        summary="One bounded observation.",
        top_risks=[{"name": "Missing Header", "severity": "low", "score": 3.1}],
        recommendations=["Configure the header."],
    ))
    db.commit()
    return scan


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


def test_html_report_export_escapes_and_contains_summary(db: Session, report_scan: Scan) -> None:
    response = export_scan_report(UUID(report_scan.id), "html", db)

    assert response.media_type == "text/html"
    assert b"One bounded observation" in response.body
    assert b"Missing Header" in response.body


def test_csv_report_export_contains_finding_rows(db: Session, report_scan: Scan) -> None:
    response = export_scan_report(UUID(report_scan.id), "csv", db)

    assert response.media_type == "text/csv"
    assert b"severity,name,source_tool" in response.body
    assert b"low,Missing Header,nuclei" in response.body


def test_sarif_report_export_is_valid_sarif(db: Session, report_scan: Scan) -> None:
    response = export_scan_report(UUID(report_scan.id), "sarif", db)
    payload = json.loads(response.body)

    assert payload["version"] == "2.1.0"
    assert payload["runs"][0]["results"][0]["ruleId"] == "missing-header"
