from __future__ import annotations

import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings

logger = logging.getLogger(__name__)


class ScannerError(RuntimeError):
    pass


@dataclass(frozen=True)
class SubfinderResult:
    hostname: str


@dataclass(frozen=True)
class HttpxResult:
    hostname: str
    url: str
    status_code: int | None
    title: str | None
    technologies: list[str]
    ip: str | None = None


@dataclass(frozen=True)
class NucleiFinding:
    host: str
    name: str
    severity: str
    template_id: str | None = None
    description: str | None = None
    cve: str | None = None
    matched_at: str | None = None
    cvss: float | None = None
    raw_json: dict[str, Any] | None = None


@dataclass(frozen=True)
class NmapServiceResult:
    host: str
    port: int
    protocol: str
    service_name: str | None = None
    product: str | None = None
    version: str | None = None
    banner: str | None = None


def run_jsonl_command(command: list[str], timeout: int) -> list[dict[str, Any]]:
    completed = run_command(command, timeout)
    items: list[dict[str, Any]] = []
    for line in completed.stdout.splitlines():
        if not line.strip():
            continue
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            logger.warning("Skipping non-JSON scanner output line from %s", command[0])
    return items


def run_command(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    binary = command[0]
    if shutil.which(binary) is None:
        raise ScannerError(f"Scanner binary '{binary}' is not installed")

    try:
        logger.info("Running scanner command: %s", " ".join(command))
        return subprocess.run(
            command,
            capture_output=True,
            check=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise ScannerError(f"Scanner '{binary}' timed out after {timeout}s") from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else "no stderr"
        raise ScannerError(f"Scanner '{binary}' failed: {stderr}") from exc


def should_use_mock(settings: Settings) -> bool:
    return not settings.enable_real_scanners
