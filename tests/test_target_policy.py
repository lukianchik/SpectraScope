import pytest

from app.core.config import Settings
from app.services.target_policy import TargetPolicyError, authorize_target


def test_lab_mode_allows_configured_target() -> None:
    settings = Settings(LAB_MODE=True, ALLOWED_LAB_TARGETS="admin.lab.local:8088,files.lab.local:8088")
    decision = authorize_target("admin.lab.local:8088", True, settings)
    assert decision.target == "admin.lab.local:8088"
    assert decision.reason == "Allowed LAB_MODE target"


def test_lab_mode_rejects_unlisted_target() -> None:
    settings = Settings(LAB_MODE=True, ALLOWED_LAB_TARGETS="admin.lab.local:8088")
    with pytest.raises(TargetPolicyError, match="LAB_MODE"):
        authorize_target("legacy.lab.local:8088", True, settings)


def test_lab_mode_requires_configured_allowlist() -> None:
    settings = Settings(LAB_MODE=True, ALLOWED_LAB_TARGETS="")
    with pytest.raises(TargetPolicyError, match="ALLOWED_LAB_TARGETS"):
        authorize_target("admin.lab.local:8088", True, settings)


def test_real_scanner_mode_requires_configured_allowlist() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="")
    with pytest.raises(TargetPolicyError, match="ALLOWED_TARGET_DOMAINS"):
        authorize_target("example.com", True, settings)


def test_real_scanner_mode_allows_configured_domain_and_subdomain() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="example.com")
    assert authorize_target("example.com", True, settings).target == "example.com"
    assert authorize_target("app.example.com", True, settings).target == "app.example.com"


def test_real_scanner_mode_rejects_target_outside_allowlist() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="example.com")
    with pytest.raises(TargetPolicyError, match="allowlist"):
        authorize_target("example.org", True, settings)
