import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE = "http://127.0.0.1:3000"


def request(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(
        BASE + path,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urlopen(req, timeout=10) as response:
        data = response.read()
        return json.loads(data) if data else {}


def wait_ready() -> None:
    deadline = time.time() + 180
    while time.time() < deadline:
        try:
            if request("/health/ready").get("status") == "ready":
                return
        except (HTTPError, URLError, TimeoutError):
            pass
        time.sleep(2)
    raise RuntimeError("Compose stack did not become ready")


def main() -> None:
    wait_ready()
    scan = request(
        "/api/scans/start",
        "POST",
        {"target": "example.com", "scan_profile": "safe", "confirm_authorized": True},
    )
    deadline = time.time() + 120
    while time.time() < deadline:
        scan = request(f"/api/scans/{scan['id']}")
        if scan["status"] in {"completed", "failed", "cancelled"}:
            break
        time.sleep(1)
    if scan["status"] != "completed":
        raise RuntimeError(f"Smoke scan ended as {scan['status']}: {scan.get('error_message')}")
    assets = request(f"/api/scans/{scan['id']}/assets?limit=200")
    findings = request(f"/api/scans/{scan['id']}/findings?limit=200")
    report = request(f"/api/scans/{scan['id']}/report")
    settings = request("/api/workspace/settings")
    monitoring = request("/api/monitoring/summary")
    if not assets["items"] or not findings["items"] or not report["summary"]:
        raise RuntimeError("Smoke scan did not produce the expected product data")
    if "runtime" not in settings or monitoring["scans_24h"] < 1:
        raise RuntimeError("Workspace or monitoring API is incomplete")
    print(json.dumps({
        "scan_id": scan["id"],
        "assets": assets["total"],
        "findings": findings["total"],
        "status": scan["status"],
    }, indent=2))


if __name__ == "__main__":
    main()
