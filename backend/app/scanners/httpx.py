from app.core.config import Settings
from app.scanners.base import HttpxResult, run_jsonl_command, should_use_mock


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

        results: list[HttpxResult] = []
        for hostname in hostnames:
            command = ["httpx", "-u", hostname, "-json", "-silent", "-tech-detect", "-title", "-status-code"]
            for row in run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds):
                results.append(
                    HttpxResult(
                        hostname=str(row.get("input") or row.get("host") or hostname).lower(),
                        url=str(row.get("url") or ""),
                        status_code=_as_int(row.get("status_code")),
                        title=row.get("title"),
                        technologies=list(row.get("tech") or []),
                        ip=row.get("host"),
                    )
                )
        return results


def _as_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
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
