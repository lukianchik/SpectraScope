import pytest

from app.services.target_validation import TargetValidationError, normalize_target


def test_normalize_valid_domain() -> None:
    assert normalize_target(" HTTPS://Example.COM/path ") == "example.com"


def test_normalize_valid_domain_with_port() -> None:
    assert normalize_target("http://Admin.Lab.Local:8088/login") == "admin.lab.local:8088"


@pytest.mark.parametrize("target", ["127.0.0.1", "10.0.0.1", "::1", "not a domain", "localhost"])
def test_rejects_invalid_or_ip_targets(target: str) -> None:
    with pytest.raises(TargetValidationError):
        normalize_target(target)


def test_rejects_invalid_port() -> None:
    with pytest.raises(TargetValidationError):
        normalize_target("admin.lab.local:99999")
