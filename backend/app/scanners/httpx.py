import os
import socket
import tempfile
from urllib.parse import urlparse

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

        target_batches: list[tuple[list[str], dict[str, str], str | None]]
        if self.settings.local_real_scanners:
            target_batches = [_resolve_local_targets([hostname]) for hostname in hostnames]
        else:
            command_targets, input_target_map = _external_probe_targets(hostnames)
            target_batches = [(command_targets, input_target_map, None)]

        results_by_hostname: dict[str, HttpxResult] = {}
        for command_hostnames, input_target_map, host_header in target_batches:
            hosts_file_path = _write_hosts_file(command_hostnames)
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
                if host_header:
                    command.extend(["-H", f"Host: {host_header}"])
                rows = run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds)
            finally:
                os.unlink(hosts_file_path)

            for row in rows:
                command_input = str(row.get("input") or row.get("host") or "").lower()
                result_url = str(row.get("url") or "")
                hostname = input_target_map.get(command_input) or input_target_map.get(result_url.lower()) or command_input
                if not hostname:
                    continue
                if self.settings.local_real_scanners:
                    result_url = f"http://{hostname}"
                candidate = HttpxResult(
                    hostname=hostname,
                    url=result_url,
                    status_code=_as_int(row.get("status_code")),
                    title=row.get("title"),
                    technologies=list(row.get("tech") or []),
                    ip=_first_ip(row),
                )
                current = results_by_hostname.get(hostname)
                if current is None or _result_score(candidate) > _result_score(current):
                    results_by_hostname[hostname] = candidate
        return list(results_by_hostname.values())


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


def _external_probe_targets(hostnames: list[str]) -> tuple[list[str], dict[str, str]]:
    command_targets: list[str] = []
    input_target_map: dict[str, str] = {}
    for hostname in hostnames:
        parsed = urlparse(hostname if "://" in hostname else f"//{hostname}")
        targets = [hostname]
        if parsed.port is not None:
            targets = [f"https://{hostname}", f"http://{hostname}"]
        for target in targets:
            command_targets.append(target)
            input_target_map[target.lower()] = hostname
    return command_targets, input_target_map


def _result_score(result: HttpxResult) -> tuple[int, int]:
    status = result.status_code or 0
    if 200 <= status < 400:
        status_score = 3
    elif 400 <= status < 500:
        status_score = 2
    elif status >= 500:
        status_score = 1
    else:
        status_score = 0
    return status_score, int(bool(result.url and result.url.lower().startswith("https://")))


def _resolve_local_targets(hostnames: list[str]) -> tuple[list[str], dict[str, str], str | None]:
    if len(hostnames) != 1:
        raise ValueError("local-real probing accepts exactly one allowlisted target")

    original = hostnames[0].lower()
    parsed = urlparse(original if "://" in original else f"//{original}")
    host = parsed.hostname
    if not host:
        raise ValueError(f"Invalid local-real target: {original}")

    address = socket.gethostbyname(host)
    port = f":{parsed.port}" if parsed.port else ""
    resolved = f"http://{address}{port}"
    return [resolved], {resolved: original}, host
