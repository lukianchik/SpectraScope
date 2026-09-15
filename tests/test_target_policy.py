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


def test_real_scanners_require_configured_allowlist() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, LAB_MODE=False, ALLOWED_TARGET_DOMAINS="")
    with pytest.raises(TargetPolicyError, match="ALLOWED_TARGET_DOMAINS"):
        authorize_target("example.com", True, settings)


def test_real_scanners_allow_allowlisted_target() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, LAB_MODE=False, ALLOWED_TARGET_DOMAINS="example.com")
    decision = authorize_target("api.example.com", True, settings)
    assert decision.target == "api.example.com"


def test_real_scanners_reject_non_allowlisted_target() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=True, LAB_MODE=False, ALLOWED_TARGET_DOMAINS="example.com")
    with pytest.raises(TargetPolicyError, match="allowlist"):
        authorize_target("example.org", True, settings)


def test_mock_mode_allows_target_without_allowlist() -> None:
    settings = Settings(ENABLE_REAL_SCANNERS=False, LAB_MODE=False, ALLOWED_TARGET_DOMAINS="")
    decision = authorize_target("example.org", True, settings)
    assert decision.target == "example.org"


def test_local_real_mode_allows_only_exact_lab_target() -> None:
    settings = Settings(
        ENABLE_REAL_SCANNERS=True,
        LOCAL_REAL_SCANNERS=True,
        ALLOWED_LAB_TARGETS="admin.lab.local:8088",
    )
    decision = authorize_target("admin.lab.local:8088", True, settings)
    assert decision.reason == "Allowed local real scanner target"

    with pytest.raises(TargetPolicyError, match="local real scanner mode"):
        authorize_target("legacy.lab.local:8088", True, settings)


def test_local_real_mode_allows_configured_perimeter_scope() -> None:
    settings = Settings(
        ENABLE_REAL_SCANNERS=True,
        LOCAL_REAL_SCANNERS=True,
        ALLOWED_LAB_TARGETS="admin.lab.local:8088,files.lab.local:8088",
        LOCAL_REAL_SCOPE_TARGET="perimeter.lab.local:8088",
    )

    decision = authorize_target("perimeter.lab.local:8088", True, settings)

    assert decision.target == "perimeter.lab.local:8088"
