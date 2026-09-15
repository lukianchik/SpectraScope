from prometheus_client import Counter, Gauge, Histogram

HTTP_REQUESTS_TOTAL = Counter(
    "spectrascope_http_requests_total",
    "Total HTTP requests.",
    ["method", "path", "status_code"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "spectrascope_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
SCANS_STARTED_TOTAL = Counter(
    "spectrascope_scans_started_total",
    "Total scans accepted by the API.",
    ["scan_profile"],
)
SCANS_COMPLETED_TOTAL = Counter(
    "spectrascope_scans_completed_total",
    "Total scans completed by the worker.",
)
SCANS_FAILED_TOTAL = Counter(
    "spectrascope_scans_failed_total",
    "Total scans failed by the worker.",
)
SCAN_PIPELINE_DURATION_SECONDS = Histogram(
    "spectrascope_scan_pipeline_duration_seconds",
    "Scan pipeline duration in seconds.",
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300),
)
SCANS_BY_STATUS = Gauge(
    "spectrascope_scans_by_status",
    "Current number of scans by status.",
    ["status"],
)
DEPENDENCY_UP = Gauge(
    "spectrascope_dependency_up",
    "Dependency readiness status. 1 means up, 0 means down.",
    ["dependency"],
)


def record_http_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    normalized_path = _normalize_path(path)
    HTTP_REQUESTS_TOTAL.labels(method=method, path=normalized_path, status_code=str(status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=normalized_path).observe(duration_seconds)


def _normalize_path(path: str) -> str:
    if path.startswith("/api/scans/"):
        parts = path.strip("/").split("/")
        if len(parts) >= 3:
            parts[2] = "{scan_id}"
            return "/" + "/".join(parts)
    return path
