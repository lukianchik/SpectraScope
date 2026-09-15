"""Run the complete product locally without Docker and verify the main workflow."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
BASE = "http://127.0.0.1:3000"


def request(path: str, method: str = "GET", payload: dict | None = None) -> tuple[int, bytes]:
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(BASE + path, data=body, method=method, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=15) as response:
        return response.status, response.read()


def json_request(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    return json.loads(request(path, method, payload)[1])


def wait_ready() -> None:
    deadline = time.time() + 45
    while time.time() < deadline:
        try:
            if json_request("/health/ready").get("status") == "ready":
                return
        except (HTTPError, URLError, TimeoutError):
            pass
        time.sleep(0.5)
    raise RuntimeError("Local product stack did not become ready")


def main() -> None:
    bun = shutil.which("bun")
    if not bun:
        raise RuntimeError("bun is required for the local product smoke test")
    creation_flags = (
        subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        if os.name == "nt"
        else 0
    )
    with tempfile.TemporaryDirectory(prefix="spectrascope-smoke-") as temp_dir:
        database_path = (Path(temp_dir) / "smoke.db").as_posix()
        env = {
            **os.environ,
            "DATABASE_URL": f"sqlite:///{database_path}",
            "CELERY_TASK_ALWAYS_EAGER": "true",
            "APP_ENV": "test",
            "AUTH_REQUIRED": "false",
            "VITE_DEMO_MODE": "false",
        }
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND,
            env=env,
            check=True,
            creationflags=creation_flags,
        )
        api = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=BACKEND,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            creationflags=creation_flags,
        )
        ui = subprocess.Popen(
            [bun, "run", "dev"],
            cwd=FRONTEND,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            creationflags=creation_flags,
        )
        try:
            wait_ready()
            index_status, index = request("/")
            if index_status != 200 or b"SpectraScope" not in index:
                raise RuntimeError("Frontend was not served through Vite")
            scan = json_request(
                "/api/scans/start",
                "POST",
                {"target": "example.com", "scan_profile": "safe", "confirm_authorized": True},
            )
            scan = json_request(f"/api/scans/{scan['id']}")
            assets = json_request(f"/api/scans/{scan['id']}/assets?limit=200")
            findings = json_request(f"/api/scans/{scan['id']}/findings?limit=200")
            export_status, _ = request(f"/api/scans/{scan['id']}/report/export?format=sarif")
            settings = json_request("/api/workspace/settings")
            if scan["status"] != "completed" or not assets["total"] or not findings["total"]:
                raise RuntimeError("The smoke scan did not complete with persisted results")
            print(json.dumps({
                "ui": index_status,
                "ready": "ready",
                "scan": scan["status"],
                "assets": assets["total"],
                "findings": findings["total"],
                "export": export_status,
                "environment": settings["runtime"]["app_env"],
            }, indent=2))
        finally:
            for process in (ui, api):
                _terminate_tree(process)


def _terminate_tree(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


if __name__ == "__main__":
    main()
