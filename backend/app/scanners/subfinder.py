from app.core.config import Settings
from app.scanners.base import SubfinderResult, run_jsonl_command, should_use_mock


class SubfinderAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def discover(self, target: str) -> list[SubfinderResult]:
        if should_use_mock(self.settings):
            prefixes = [
                "api",
                "www",
                "admin",
                "blog",
                "dev",
                "app",
                "auth",
                "cdn",
                "docs",
                "mail",
                "shop",
                "status",
                "staging",
                "beta",
                "portal",
                "support",
                "static",
                "media",
                "files",
                "vpn",
                "grafana",
                "kibana",
                "ci",
                "old",
            ]
            return [SubfinderResult(hostname=f"{prefix}.{target}") for prefix in prefixes]

        command = ["subfinder", "-d", target, "-silent", "-json"]
        rows = run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds)
        results = []
        for row in rows:
            host = row.get("host") or row.get("input")
            if host:
                results.append(SubfinderResult(hostname=str(host).lower()))
        return results
