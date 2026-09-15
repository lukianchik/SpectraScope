import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_scanner_limits_have_safe_defaults() -> None:
    settings = Settings()

    assert settings.scanner_timeout_seconds == 60
    assert settings.scanner_max_results == 200


def test_scanner_limits_accept_environment_aliases() -> None:
    settings = Settings(SCANNER_TIMEOUT_SECONDS=120, SCANNER_MAX_RESULTS=500)

    assert settings.scanner_timeout_seconds == 120
    assert settings.scanner_max_results == 500


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("SCANNER_TIMEOUT_SECONDS", 0),
        ("SCANNER_TIMEOUT_SECONDS", 3601),
        ("SCANNER_MAX_RESULTS", 0),
        ("SCANNER_MAX_RESULTS", 10_001),
    ],
)
def test_scanner_limits_reject_unsafe_values(field: str, value: int) -> None:
    with pytest.raises(ValidationError):
        Settings(**{field: value})


def test_production_requires_authentication_and_secure_sessions() -> None:
    with pytest.raises(ValidationError, match="Unsafe production configuration"):
        Settings(APP_ENV="production")


def test_safe_production_configuration_is_accepted() -> None:
    settings = Settings(
        APP_ENV="production",
        AUTH_REQUIRED=True,
        AUTH_PASSWORD_HASH="pbkdf2_sha256$600000$salt$digest",
        SESSION_SECRET="s" * 64,
        SESSION_COOKIE_SECURE=True,
        INTEGRATION_SECRET_KEY="i" * 64,
        CELERY_TASK_ALWAYS_EAGER=False,
    )

    assert settings.auth_required is True
