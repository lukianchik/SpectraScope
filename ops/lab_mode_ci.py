#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


TARGETS = [
    ("admin.lab.local:8088", "Exposed Admin Panel Demo"),
    ("legacy.lab.local:8088", "Legacy Service Demo"),
    ("files.lab.local:8088", "Directory Listing Demo"),
]


def main() -> int:
    base_url = os.environ.get("LAB_MODE_API_BASE_URL", "http://127.0.0.1:8000")
    results_path = Path(os.environ.get("LAB_MODE_RESULTS_PATH", "artifacts/lab-mode-results.json"))
    startup_timeout = int(os.environ.get("LAB_MODE_STARTUP_TIMEOUT", "120"))
    scan_timeout = int(os.environ.get("LAB_MODE_SCAN_TIMEOUT", "180"))
    results_path.parent.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    errors: list[str] = []

    try:
        wait_for_ready(base_url, startup_timeout)
        for target, expected_finding in TARGETS:
            scan = request_json(
                "POST",
                f"{base_url}/api/scans/start",
                {
                    "target": target,
                    "scan_profile": "lab",
                    "confirm_authorized": True,
                },
            )
            scan_id = scan["id"]
            final_scan = poll_scan(base_url, scan_id, scan_timeout)
            findings = request_json(
                "GET",
                f"{base_url}/api/scans/{scan_id}/findings?limit=200&offset=0",
            )
            report = request_json("GET", f"{base_url}/api/scans/{scan_id}/report")
            finding_names = [item["name"] for item in findings.get("items", [])]
            finding_found = expected_finding in finding_names
            report_created = bool(report.get("summary")) and isinstance(report.get("top_risks"), list) and isinstance(
                report.get("recommendations"),
                list,
            )
            result = {
                "target": target,
                "expected_finding": expected_finding,
                "scan_id": scan_id,
                "scan_status": final_scan["status"],
                "finding_found": finding_found,
                "report_created": report_created,
            }
            results.append(result)
            if final_scan["status"] != "completed":
                errors.append(f"{target}: scan finished with status {final_scan['status']}")
            if not finding_found:
                errors.append(f"{target}: expected finding '{expected_finding}' was not returned")
            if not report_created:
                errors.append(f"{target}: report payload is incomplete")
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
    finally:
        payload = {
            "mode": "LAB_MODE",
            "results": results,
            "errors": errors,
        }
        results_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        write_summary(results, errors)

    return 1 if errors else 0


def wait_for_ready(base_url: str, timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error = "backend did not become ready"
    while time.monotonic() < deadline:
        try:
            payload = request_json("GET", f"{base_url}/health/ready")
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            time.sleep(2)
            continue
        if payload.get("status") == "ready":
            return
        last_error = f"unexpected readiness payload: {payload}"
        time.sleep(2)
    raise RuntimeError(f"Backend readiness timeout after {timeout_seconds}s: {last_error}")


def poll_scan(base_url: str, scan_id: str, timeout_seconds: int) -> dict:
    deadline = time.monotonic() + timeout_seconds
    last_payload: dict | None = None
    while time.monotonic() < deadline:
        payload = request_json("GET", f"{base_url}/api/scans/{scan_id}")
        last_payload = payload
        if payload.get("status") in {"completed", "failed"}:
            return payload
        time.sleep(2)
    raise RuntimeError(f"Scan {scan_id} did not finish in {timeout_seconds}s; last payload: {last_payload}")


def request_json(method: str, url: str, data: dict | None = None) -> dict:
    body = None
    headers = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with {exc.code}: {response_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{method} {url} failed: {exc.reason}") from exc


def write_summary(results: list[dict], errors: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [
        "# LAB_MODE Demo Loop",
        "",
        "| Target | Expected finding | Status | Scan ID |",
        "| --- | --- | --- | --- |",
    ]
    if results:
        for result in results:
            status = "passed" if result["finding_found"] and result["report_created"] and result["scan_status"] == "completed" else "failed"
            lines.append(
                f"| {result['target']} | {result['expected_finding']} | {status} | {result['scan_id']} |"
            )
    else:
        lines.append("| n/a | n/a | failed | n/a |")
    if errors:
        lines.extend(["", "## Errors", ""])
        lines.extend(f"- {error}" for error in errors)
    Path(summary_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
