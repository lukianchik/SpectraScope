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
