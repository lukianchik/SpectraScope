from app.core.config import Settings
from app.services.integration_delivery import open_config, seal_config


def test_integration_config_is_encrypted_at_rest() -> None:
    settings = Settings(INTEGRATION_SECRET_KEY="i" * 64)
    original = {"webhook_url": "https://hooks.invalid/private-token"}

    sealed = seal_config(original, settings)

    assert "private-token" not in str(sealed)
    assert sealed["fields"] == ["webhook_url"]
    assert open_config(sealed, settings) == original


def test_integration_config_cannot_be_opened_with_another_key() -> None:
    sealed = seal_config(
        {"webhook_url": "https://hooks.invalid/private-token"},
        Settings(INTEGRATION_SECRET_KEY="a" * 64),
    )

    try:
        open_config(sealed, Settings(INTEGRATION_SECRET_KEY="b" * 64))
    except ValueError as exc:
        assert "cannot be decrypted" in str(exc)
    else:
        raise AssertionError("Config encrypted with another key must not be readable")
