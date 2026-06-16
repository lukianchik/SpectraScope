from app.core.config import Settings
from app.scanners.base import SubfinderResult, run_jsonl_command, should_use_mock


SUBFINDER_TIMEOUT_CAP_SECONDS = 30


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

        command = [
            "subfinder",
            "-d",
            target,
            "-silent",
            "-json",
            "-timeout",
            str(min(self.settings.scanner_timeout_seconds, SUBFINDER_TIMEOUT_CAP_SECONDS)),
        ]
        rows = run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds)
        results = []
        seen_hosts: set[str] = set()
        for row in rows:
            host = row.get("host") or row.get("input")
            if host:
                hostname = str(host).lower()
                if hostname in seen_hosts:
                    continue
                seen_hosts.add(hostname)
                results.append(SubfinderResult(hostname=hostname))
                if len(results) >= self.settings.scanner_max_results:
                    break
        return results
