import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.scan import ScanStartRequest
from app.services.scan_profiles import (
    ScanProfileError,
    normalize_scan_profile,
    should_run_nmap_stage,
    should_run_nuclei_stage,
    validate_scan_profile_for_settings,
)


def test_unknown_scan_profile_is_rejected_by_schema() -> None:
    with pytest.raises(ValidationError, match="Unsupported scan_profile"):
        ScanStartRequest(target="example.com", scan_profile="aggressive", confirm_authorized=True)


def test_scan_profile_is_normalized() -> None:
    assert normalize_scan_profile(" SAFE ") == "safe"


def test_lab_profile_requires_lab_mode() -> None:
    settings = Settings(LAB_MODE=False)
    with pytest.raises(ScanProfileError, match="LAB_MODE=true"):
        validate_scan_profile_for_settings("lab", settings)


def test_lab_mode_rejects_non_lab_profile() -> None:
    settings = Settings(LAB_MODE=True)
    with pytest.raises(ScanProfileError, match="LAB_MODE only supports"):
        validate_scan_profile_for_settings("safe", settings)


def test_discovery_profile_skips_nuclei_and_nmap_stages() -> None:
    profile = validate_scan_profile_for_settings("discovery", Settings(LAB_MODE=False))
    assert should_run_nuclei_stage(profile) is False
    assert should_run_nmap_stage(profile) is False


def test_safe_profile_enables_nuclei_and_optional_nmap_stages() -> None:
    profile = validate_scan_profile_for_settings("safe", Settings(LAB_MODE=False))
    assert should_run_nuclei_stage(profile) is True
    assert should_run_nmap_stage(profile) is True


def test_lab_profile_skips_external_scanner_stages_in_lab_mode() -> None:
    profile = validate_scan_profile_for_settings("lab", Settings(LAB_MODE=True))
    assert should_run_nuclei_stage(profile) is False
    assert should_run_nmap_stage(profile) is False


def test_local_real_profile_requires_explicit_runtime_flags() -> None:
    with pytest.raises(ScanProfileError, match="LOCAL_REAL_SCANNERS=true"):
        validate_scan_profile_for_settings("local-real", Settings())


def test_local_real_profile_runs_nuclei_without_nmap() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, LOCAL_REAL_SCANNERS=True)
    profile = validate_scan_profile_for_settings("local-real", settings)
    assert should_run_nuclei_stage(profile) is True
    assert should_run_nmap_stage(profile) is False
