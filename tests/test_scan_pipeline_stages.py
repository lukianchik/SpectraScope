import pytest

from app.core.config import Settings
from app.models import Finding, Scan
from app.services.scan_pipeline import (
    _local_real_hostnames,
    _run_stage,
    _run_tracked_stage,
    build_risk_report,
)


class CommitRecorder:
    def __init__(self) -> None:
        self.commits = 0

    def commit(self) -> None:
        self.commits += 1


def test_run_stage_returns_action_result() -> None:
    assert _run_stage("discovery", "scan-1", lambda: ["asset"]) == ["asset"]


def test_run_stage_wraps_error_with_stage_name() -> None:
    def fail() -> None:
        raise ValueError("scanner exploded")

    with pytest.raises(RuntimeError, match="discovery stage failed: scanner exploded"):
        _run_stage("discovery", "scan-1", fail)


def test_tracked_stage_persists_success_diagnostics() -> None:
    scan = Scan(
        id="scan-1",
        target="perimeter.lab.local:8088",
        scan_profile="local-real",
        stage_diagnostics=[],
    )
    db = CommitRecorder()

    result = _run_tracked_stage(
        scan,
        db,  # type: ignore[arg-type]
        "probing",
        "httpx",
        lambda: ["asset-1", "asset-2"],
        target_count=3,
    )

    assert result == ["asset-1", "asset-2"]
    assert db.commits == 2
    assert scan.stage_diagnostics[0]["status"] == "completed"
    assert scan.stage_diagnostics[0]["target_count"] == 3
    assert scan.stage_diagnostics[0]["result_count"] == 2
    assert scan.stage_diagnostics[0]["exit_code"] == 0
    assert scan.stage_diagnostics[0]["duration_ms"] >= 0


def test_tracked_stage_persists_failure_diagnostics() -> None:
    scan = Scan(
        id="scan-2",
        target="perimeter.lab.local:8088",
        scan_profile="local-real",
        stage_diagnostics=[],
    )
    db = CommitRecorder()

    with pytest.raises(RuntimeError, match="nuclei stage failed"):
        _run_tracked_stage(
            scan,
            db,  # type: ignore[arg-type]
            "nuclei",
            "nuclei",
            lambda: (_ for _ in ()).throw(ValueError("template failure")),
            target_count=3,
        )

    diagnostic = scan.stage_diagnostics[0]
    assert db.commits == 2
    assert diagnostic["status"] == "failed"
    assert diagnostic["exit_code"] is None
    assert "template failure" in diagnostic["error"]


def test_local_real_perimeter_expands_only_configured_child_targets() -> None:
    settings = Settings(
        LOCAL_REAL_SCOPE_TARGET="perimeter.lab.local:8088",
        ALLOWED_LAB_TARGETS=(
            "perimeter.lab.local:8088,admin.lab.local:8088,"
            "legacy.lab.local:8088,files.lab.local:8088"
        ),
    )

    assert _local_real_hostnames("perimeter.lab.local:8088", settings) == [
        "admin.lab.local:8088",
        "legacy.lab.local:8088",
        "files.lab.local:8088",
    ]
    assert _local_real_hostnames("admin.lab.local:8088", settings) == ["admin.lab.local:8088"]


def test_risk_report_groups_repeated_templates_and_builds_specific_actions() -> None:
    scan = Scan(id="scan-1", target="perimeter.lab.local:8088", scan_profile="local-real")
    findings = [
        Finding(
            scan_id=scan.id,
            asset_id="asset-1",
            source_tool="nuclei",
            template_id="spectrascope-missing-security-headers-demo",
            name="Missing Browser Security Headers",
            severity="low",
        ),
        Finding(
            scan_id=scan.id,
            asset_id="asset-2",
            source_tool="nuclei",
            template_id="spectrascope-missing-security-headers-demo",
            name="Missing Browser Security Headers",
            severity="low",
        ),
        Finding(
            scan_id=scan.id,
            asset_id="asset-1",
            source_tool="nuclei",
            template_id="spectrascope-exposed-admin-panel-demo",
            name="Exposed Admin Panel Demo",
            severity="high",
        ),
    ]

    report = build_risk_report(scan, findings, asset_count=2)

    headers_risk = next(item for item in report.top_risks if item["name"] == "Missing Browser Security Headers")
    assert headers_risk["affected_assets"] == 2
    assert headers_risk["score"] == 3.0
    assert "reachable asset" in headers_risk["reason"]
    assert "security-header baseline" in headers_risk["recommended_action"]
    assert any("administrative interfaces" in item for item in report.recommendations)
    assert any("security-header baseline" in item for item in report.recommendations)
