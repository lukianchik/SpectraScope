from app.core.config import Settings
from app.scanners.base import HttpxResult, run_jsonl_command, should_use_mock


class HttpxAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def probe(self, hostnames: list[str]) -> list[HttpxResult]:
        if should_use_mock(self.settings):
            return [
                HttpxResult(
                    hostname=hostname,
                    url=f"https://{hostname}",
                    status_code=200,
                    title="Mock web application",
                    technologies=["mock-server"],
                )
                for hostname in hostnames
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
