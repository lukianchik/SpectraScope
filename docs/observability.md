# Observability

SpectraScope writes application logs to stdout and exposes Prometheus metrics on `/metrics`.

## Runtime Endpoints

- `GET /health/live` - process liveness probe.
- `GET /health/ready` - readiness probe for Postgres and Redis.
- `GET /metrics` - Prometheus metrics endpoint.

## Logs

Default log format is JSON:

```env
LOG_FORMAT=json
LOG_LEVEL=INFO
SERVICE_NAME=spectrascope-backend
```

Container stdout can be shipped to Loki, ELK, Vector, Fluent Bit, or a cloud logging backend. Every HTTP request log includes:

- `timestamp`
- `level`
- `logger`
- `service`
- `request_id`
- `method`
- `path`
- `status_code`
- `duration_ms`

Clients can pass `X-Request-ID`; otherwise the API generates one.

## Metrics

Current metrics include:

- `spectrascope_http_requests_total`
- `spectrascope_http_request_duration_seconds`
- `spectrascope_scans_started_total`
- `spectrascope_scans_completed_total`
- `spectrascope_scans_failed_total`
- `spectrascope_scan_pipeline_duration_seconds`
- `spectrascope_scans_by_status`
- `spectrascope_dependency_up`

Example Prometheus config is available at `ops/prometheus/prometheus.yml`.

## Single-Server Deployment

For a first deployment on one server:

1. Run `backend`, `worker`, `postgres`, and `redis` with Docker Compose.
2. Add Prometheus with a scrape target for `backend:8000/metrics`.
3. Add Grafana and import panels for request rate, latency, scan success/failure, and dependency status.
4. Add Loki or another log shipper for container stdout.

## Kubernetes Direction

When moving to Kubernetes:

- Use `/health/live` for `livenessProbe`.
- Use `/health/ready` for `readinessProbe`.
- Run API and worker as separate Deployments.
- Run Postgres/Redis as managed services or StatefulSets.
- Expose `/metrics` with a `ServiceMonitor` if using Prometheus Operator.
- Route logs from stdout to Loki/ELK using the cluster log collector.
