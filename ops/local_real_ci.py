#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


EXPECTED_FINDINGS = {
    "Exposed Admin Panel Demo",
    "Legacy Service Demo",
    "Directory Listing Demo",
    "Missing Browser Security Headers",
}
EXPECTED_STAGES = {"probing", "nuclei", "reporting"}


def main() -> int:
    base_url = os.environ.get("LOCAL_REAL_API_BASE_URL", "http://127.0.0.1:8000")
    results_path = Path(os.environ.get("LOCAL_REAL_RESULTS_PATH", "artifacts/local-real-results.json"))
    results_path.parent.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    result: dict = {"mode": "local-real", "target": "perimeter.lab.local:8088"}

    try:
        wait_for_ready(base_url, 180)
        scan = request_json(
            "POST",
            f"{base_url}/api/scans/start",
            {
                "target": result["target"],
                "scan_profile": "local-real",
                "confirm_authorized": True,
            },
        )
        final_scan = poll_scan(base_url, scan["id"], 240)
        assets = request_json("GET", f"{base_url}/api/scans/{scan['id']}/assets?limit=200")
        findings = request_json("GET", f"{base_url}/api/scans/{scan['id']}/findings?limit=200")
        report = request_json("GET", f"{base_url}/api/scans/{scan['id']}/report")

        finding_names = {item["name"] for item in findings["items"]}
        diagnostics = final_scan.get("stage_diagnostics", [])
        diagnostic_stages = {item.get("stage") for item in diagnostics}
        risks_explained = all(
            item.get("reason") and item.get("recommended_action")
            for item in report.get("top_risks", [])
        )

        checks = {
            "scan_completed": final_scan.get("status") == "completed",
            "three_assets": assets.get("total") == 3,
            "six_findings": findings.get("total") == 6,
            "expected_findings": EXPECTED_FINDINGS <= finding_names,
            "stage_diagnostics": EXPECTED_STAGES <= diagnostic_stages
            and all(item.get("status") == "completed" for item in diagnostics),
            "explained_risks": bool(report.get("top_risks")) and risks_explained,
        }
        result.update(
            scan_id=scan["id"],
            status=final_scan.get("status"),
            assets=assets.get("total"),
            findings=findings.get("total"),
            checks=checks,
        )
        errors.extend(name for name, passed in checks.items() if not passed)
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))

    payload = {"result": result, "errors": errors}
    results_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_summary(result, errors)
    return 1 if errors else 0


def wait_for_ready(base_url: str, timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            if request_json("GET", f"{base_url}/health/ready").get("status") == "ready":
                return
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2)
    raise RuntimeError("Backend readiness timeout")


def poll_scan(base_url: str, scan_id: str, timeout_seconds: int) -> dict:
    deadline = time.monotonic() + timeout_seconds
    last_payload: dict = {}
    while time.monotonic() < deadline:
        last_payload = request_json("GET", f"{base_url}/api/scans/{scan_id}")
        if last_payload.get("status") in {"completed", "failed", "cancelled"}:
            return last_payload
        time.sleep(2)
    raise RuntimeError(f"Scan timeout; last payload: {last_payload}")


def request_json(method: str, url: str, data: dict | None = None) -> dict:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with {exc.code}: {payload}") from exc


def write_summary(result: dict, errors: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    checks = result.get("checks", {})
    lines = ["# Local real scanner", "", f"Scan: `{result.get('scan_id', 'not started')}`", ""]
    lines.extend(f"- {'PASS' if passed else 'FAIL'}: {name}" for name, passed in checks.items())
    if errors:
        lines.extend(["", "## Errors", *[f"- {error}" for error in errors]])
    Path(summary_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
