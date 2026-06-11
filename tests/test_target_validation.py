import pytest

from app.services.target_validation import TargetValidationError, normalize_target


def test_normalize_valid_domain() -> None:
    assert normalize_target(" HTTPS://Example.COM/path ") == "example.com"


@pytest.mark.parametrize("target", ["127.0.0.1", "10.0.0.1", "::1", "not a domain", "localhost"])
def test_rejects_invalid_or_ip_targets(target: str) -> None:
    with pytest.raises(TargetValidationError):
        normalize_target(target)
