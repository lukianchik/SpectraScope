import ipaddress
import re
from urllib.parse import urlparse


class TargetValidationError(ValueError):
    pass


DOMAIN_RE = re.compile(
    r"^(?=.{3,255}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)


def normalize_target(raw_target: str) -> str:
    target = raw_target.strip().lower()
    if not target:
        raise TargetValidationError("Target is required")

    parsed = urlparse(target if "://" in target else f"//{target}")
    hostname = parsed.hostname or target
    hostname = hostname.rstrip(".")

    if _is_ip_address(hostname):
        raise TargetValidationError("IP targets are not allowed by default; provide a public domain you are authorized to scan")

    if not DOMAIN_RE.fullmatch(hostname):
        raise TargetValidationError("Target must be a valid domain name")

    try:
        port = parsed.port
    except ValueError as exc:
        raise TargetValidationError("Target port must be a valid integer between 1 and 65535") from exc

    if port is not None and not 1 <= port <= 65535:
        raise TargetValidationError("Target port must be between 1 and 65535")

    return f"{hostname}:{port}" if port is not None else hostname


def split_target_host_port(target: str) -> tuple[str, int | None]:
    parsed = urlparse(target if "://" in target else f"//{target}")
    hostname = (parsed.hostname or target).rstrip(".")
    return hostname, parsed.port


def _is_ip_address(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True
