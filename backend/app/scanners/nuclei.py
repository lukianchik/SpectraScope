from app.core.config import Settings
from app.scanners.base import NucleiFinding, run_jsonl_command, should_use_mock


class NucleiAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def scan(self, urls: list[str]) -> list[NucleiFinding]:
        if should_use_mock(self.settings):
            return [
                NucleiFinding(
                    host=urls[0],
                    name="Security headers review",
                    severity="info",
                    template_id="mock-security-headers",
                    description="Mock finding produced in dev mode; no real vulnerability scan was executed.",
                    matched_at=urls[0],
                    raw_json={"mock": True, "tool": "nuclei"},
                )
            ] if urls else []

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
