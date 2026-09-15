import socket

import pytest

from app.core.config import Settings
from app.services.network_policy import NetworkPolicyError, validate_external_network_targets


def real_settings() -> Settings:
    return Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="example.com")


def test_external_target_must_resolve_to_public_ip(monkeypatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))],
    )

    validate_external_network_targets(["api.example.com", "https://www.example.com/path"], real_settings())


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.5", "169.254.169.254", "198.18.1.35", "::1"])
def test_external_target_rejects_non_public_dns_answers(monkeypatch, address: str) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0))],
    )

    with pytest.raises(NetworkPolicyError, match="non-public"):
        validate_external_network_targets(["api.example.com"], real_settings())


def test_explicit_benchmark_dns_proxy_mode_accepts_only_the_proxy_range(monkeypatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("198.18.1.35", 0))],
    )

    settings = Settings(
        ENABLE_REAL_SCANNERS=True,
        ALLOWED_TARGET_DOMAINS="example.com",
        ALLOW_BENCHMARK_DNS_PROXY=True,
    )
    validate_external_network_targets(["api.example.com"], settings)


def test_discovered_target_cannot_escape_authorized_scope(monkeypatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))],
    )

    with pytest.raises(NetworkPolicyError, match="outside"):
        validate_external_network_targets(["example.org"], real_settings())


def test_mock_and_local_real_modes_do_not_apply_public_dns_policy() -> None:
    validate_external_network_targets(["admin.lab.local:8088"], Settings())
    validate_external_network_targets(
        ["admin.lab.local:8088"],
        Settings(ENABLE_REAL_SCANNERS=True, LOCAL_REAL_SCANNERS=True),
    )
