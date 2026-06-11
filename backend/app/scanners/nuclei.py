from app.core.config import Settings
from app.scanners.base import NucleiFinding, run_jsonl_command, should_use_mock


class NucleiAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def scan(self, urls: list[str]) -> list[NucleiFinding]:
        if should_use_mock(self.settings):
            url_by_prefix = {url.split("//", 1)[-1].split(".", 1)[0]: url for url in urls}
            ordered_findings = [
                _mock_finding(
                    url_by_prefix,
                    "api",
                    name="Missing Security Headers",
                    severity="medium",
                    template_id="mock-missing-security-headers",
                    description="Required browser security headers are not consistently configured.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "admin",
                    name="Exposed Admin Panel",
                    severity="high",
                    template_id="mock-exposed-admin-panel",
                    description="Administrative interface is reachable from the public internet.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "www",
                    name="TLS Certificate Expiring Soon",
                    severity="low",
                    template_id="mock-tls-expiring-soon",
                    description="TLS certificate should be renewed before expiration.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "blog",
                    name="Directory Listing Enabled",
                    severity="medium",
                    template_id="mock-directory-listing",
                    description="Directory listing may expose files that were not intended to be public.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "dev",
                    name="Outdated Server Version",
                    severity="medium",
                    template_id="mock-outdated-server-version",
                    description="Server version appears outdated and should be reviewed.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "portal",
                    name="TLS Certificate Expiring Soon",
                    severity="low",
                    template_id="mock-tls-expiring-soon",
                    description="TLS certificate should be renewed before expiration.",
                ),
                _mock_finding(
                    url_by_prefix,
                    "support",
                    name="Directory Listing Enabled",
                    severity="medium",
                    template_id="mock-directory-listing",
                    description="Directory listing may expose files that were not intended to be public.",
                ),
            ]
            extra_missing_headers = [
                _mock_finding(
                    url_by_prefix,
                    prefix,
                    name="Missing Security Headers",
                    severity="medium",
                    template_id="mock-missing-security-headers",
                    description="Required browser security headers are not consistently configured.",
                )
                for prefix in ["www", "admin", "blog", "dev", "app", "auth", "portal"]
                if prefix in url_by_prefix
            ]
            extra_findings = [
                _mock_finding(
                    url_by_prefix,
                    "old",
                    name="Outdated Server Version",
                    severity="medium",
                    template_id="mock-outdated-server-version",
                    description="Server version appears outdated and should be reviewed.",
                )
            ]
            return ordered_findings + extra_missing_headers + extra_findings

        findings: list[NucleiFinding] = []
        for url in urls:
            command = ["nuclei", "-u", url, "-jsonl", "-severity", "info,low,medium,high,critical"]
            for row in run_jsonl_command(command, timeout=self.settings.scanner_timeout_seconds):
                info = row.get("info") or {}
                classification = info.get("classification") or {}
                findings.append(
                    NucleiFinding(
                        host=str(row.get("host") or url),
                        name=str(info.get("name") or row.get("template-id") or "Nuclei finding"),
                        severity=str(info.get("severity") or "info").lower(),
                        template_id=row.get("template-id"),
                        description=info.get("description"),
                        cve=_first_or_none(classification.get("cve-id")),
                        matched_at=row.get("matched-at"),
                        cvss=_as_float(classification.get("cvss-score")),
                        raw_json=row,
                    )
                )
        return findings


def _first_or_none(value: object) -> str | None:
    if isinstance(value, list) and value:
        return str(value[0])
    if isinstance(value, str) and value:
        return value
    return None


def _as_float(value: object) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _mock_finding(
    url_by_prefix: dict[str, str],
    prefix: str,
    name: str,
    severity: str,
    template_id: str,
    description: str,
) -> NucleiFinding:
    url = url_by_prefix[prefix]
    return NucleiFinding(
        host=url,
        name=name,
        severity=severity,
        template_id=template_id,
        description=description,
        matched_at=url,
        raw_json={"mock": True, "tool": "nuclei", "site_preview": True},
    )
