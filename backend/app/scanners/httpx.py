import os
import tempfile

from app.core.config import Settings
from app.scanners.base import HttpxResult, run_jsonl_command, should_use_mock


HTTPX_TIMEOUT_SECONDS = 5
HTTPX_THREADS = 25


class HttpxAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def probe(self, hostnames: list[str]) -> list[HttpxResult]:
        if should_use_mock(self.settings):
            fixed_ips = {
                "api": "93.184.216.34",
                "www": "93.184.216.34",
                "admin": "93.184.216.35",
                "blog": "93.184.216.36",
                "dev": "93.184.216.37",
            }
            return [
                HttpxResult(
                    hostname=hostname,
                    url=f"https://{hostname}",
                    status_code=200,
                    title=_mock_title(hostname),
                    technologies=_mock_technologies(hostname),
                    ip=_mock_ip(hostname, fixed_ips, index),
                )
                for index, hostname in enumerate(hostnames)
            ]

        if not hostnames:
            return []

        hosts_file_path = _write_hosts_file(hostnames)
        try:
            command = [
                "httpx",
                "-l",
                hosts_file_path,
                "-json",
                "-silent",
                "-tech-detect",
                "-title",
                "-status-code",
                "-threads",
                str(HTTPX_THREADS),
                "-timeout",
                str(HTTPX_TIMEOUT_SECONDS),
                "-retries",
                "0",
            ]
            rows = run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds)
        finally:
            os.unlink(hosts_file_path)

        results: list[HttpxResult] = []
        for row in rows:
            hostname = str(row.get("input") or row.get("host") or "").lower()
            if not hostname:
                continue
            results.append(
                HttpxResult(
                    hostname=hostname,
                    url=str(row.get("url") or ""),
                    status_code=_as_int(row.get("status_code")),
                    title=row.get("title"),
                    technologies=list(row.get("tech") or []),
                    ip=_first_ip(row),
                )
            )
        return results


def _as_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _first_ip(row: dict) -> str | None:
    host_ip = row.get("host_ip")
    if host_ip:
        return str(host_ip)
    addresses = row.get("a")
    if isinstance(addresses, list) and addresses:
        return str(addresses[0])
    return None


def _mock_ip(hostname: str, fixed_ips: dict[str, str], index: int) -> str:
    prefix = hostname.split(".", 1)[0]
    return fixed_ips.get(prefix, f"93.184.216.{40 + index}")


def _mock_title(hostname: str) -> str:
    prefix = hostname.split(".", 1)[0].replace("-", " ").title()
    return f"{prefix} Service"


def _mock_technologies(hostname: str) -> list[str]:
    prefix = hostname.split(".", 1)[0]
    if prefix in {"api", "auth", "app"}:
        return ["nginx", "FastAPI"]
    if prefix in {"admin", "portal", "grafana", "kibana"}:
        return ["nginx", "React"]
    if prefix in {"blog", "www", "docs"}:
        return ["nginx", "static-site"]
    return ["nginx"]


def _write_hosts_file(hostnames: list[str]) -> str:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as hosts_file:
        for hostname in hostnames:
            hosts_file.write(f"{hostname}\n")
        return hosts_file.name
