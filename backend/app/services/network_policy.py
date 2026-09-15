import ipaddress
import socket
from urllib.parse import urlparse

from app.core.config import Settings


class NetworkPolicyError(ValueError):
    pass


BENCHMARK_DNS_PROXY_NETWORK = ipaddress.ip_network("198.18.0.0/15")


def validate_external_network_targets(targets: list[str], settings: Settings) -> None:
    if not settings.enable_real_scanners or settings.local_real_scanners or settings.lab_mode:
        return
    for target in targets:
        hostname = _hostname(target)
        if not any(hostname == root or hostname.endswith(f".{root.lstrip('.')}") for root in settings.allowed_domain_list):
            raise NetworkPolicyError(f"Resolved scanner target {hostname} is outside the authorized scope")
        try:
            addresses = {item[4][0] for item in socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)}
        except socket.gaierror as exc:
            raise NetworkPolicyError(f"Authorized target {hostname} did not resolve") from exc
        if not addresses:
            raise NetworkPolicyError(f"Authorized target {hostname} did not resolve")
        for address in addresses:
            parsed = ipaddress.ip_address(address)
            if settings.allow_benchmark_dns_proxy and parsed in BENCHMARK_DNS_PROXY_NETWORK:
                continue
            if not parsed.is_global:
                raise NetworkPolicyError(
                    f"Authorized target {hostname} resolved to non-public address {parsed.compressed}"
                )


def _hostname(value: str) -> str:
    parsed = urlparse(value if "://" in value else f"//{value}")
    if not parsed.hostname:
        raise NetworkPolicyError(f"Invalid scanner target: {value}")
    return parsed.hostname.lower().rstrip(".")
