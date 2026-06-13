# SpectraScope

SpectraScope is an MVP platform skeleton for applied cyber intelligence and external attack surface analysis. A user submits a domain or an approved lab target, the backend starts a safe discovery pipeline, stores assets and baseline findings in PostgreSQL, and exposes the results through an API.

This project is intended only for assets you own or are explicitly authorized to assess. It is not an exploitation framework or an automated pentest tool.

## Stack

- Backend: Python 3.11, FastAPI, SQLAlchemy, Alembic, Pydantic
- Queue: Redis + Celery
- Database: PostgreSQL
- Infrastructure: Docker Compose
- Scanner adapters: `subfinder`, `httpx`, `nuclei`, optional `nmap`

By default `ENABLE_REAL_SCANNERS=false`, so scanner adapters return mock results and do not execute external scanner binaries.
The mock pipeline returns dashboard-ready preview data for public-domain style scans such as `example.com`: 24 assets, 15 findings, top risks, and a generated report summary.
This default mode validates the product flow end-to-end, but it is not a real external recon scan. Real scanner execution must be explicitly enabled and allowlisted as described in [Scanner Safety](#scanner-safety).

## Run

```bash
docker compose up --build
```

Open Swagger UI:

```text
http://localhost:8000/docs
```

Healthcheck:

```bash
curl http://localhost:8000/health
```

Start a test scan:

```bash
curl -X POST http://localhost:8000/api/scans/start \
  -H "Content-Type: application/json" \
  -d '{"target":"example.com","scan_profile":"safe","confirm_authorized":true}'
```

Then use the returned `id`:

```bash
curl http://localhost:8000/api/scans/<scan_id>
curl http://localhost:8000/api/scans
curl "http://localhost:8000/api/scans/<scan_id>/assets?limit=50&offset=0"
curl "http://localhost:8000/api/scans/<scan_id>/findings?severity=info"
curl http://localhost:8000/api/scans/<scan_id>/report
curl http://localhost:8000/api/scans/<scan_id>/audit
```

Start a LAB_MODE scan:

```bash
curl -X POST http://localhost:8000/api/scans/start \
  -H "Content-Type: application/json" \
  -d '{"target":"admin.lab.local:8088","scan_profile":"lab","confirm_authorized":true}'
```

## Local Development Without Docker

For fast backend iteration, run the API with SQLite and eager Celery tasks:

```bash
cp .env.local.example .env
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

With `CELERY_TASK_ALWAYS_EAGER=true`, `POST /api/scans/start` runs the mock pipeline in the API process. Redis and the Celery worker are not required in this local profile.

## MVP Scope

- FastAPI app with health, scan start, scan status, assets, findings, and report endpoints.
- Scan listing endpoint with basic pagination and filters.
- Asset and finding pagination with basic filters.
- SQLAlchemy models and Alembic initial migration for scans, assets, services, findings, and risk reports.
- Audit log table for scan launch authorization decisions.
- Celery worker task `run_scan(scan_id)` with a safe scanner pipeline.
- Target validation that accepts domains and rejects direct IP targets by default.
- Target validation that preserves `host:port` for approved local lab targets.
- Target policy requiring explicit authorization confirmation and supporting `ALLOWED_TARGET_DOMAINS` for normal mode plus `ALLOWED_LAB_TARGETS` for `LAB_MODE`.
- Scanner adapters with normalized Python objects and safe subprocess execution: no `shell=True`, timeout handling, binary detection, and error propagation.
- Development mock mode for checking the whole flow without installing scanner tools.
- Safe `LAB_MODE` using plain HTTP `GET` requests against allowlisted demo targets without real scanner binaries.
- Docker Compose services for backend, worker, Postgres, and Redis.

## Scanner Safety

Real scanner execution is opt-in with:

```env
ENABLE_REAL_SCANNERS=true
```

The initial `nmap` adapter is disabled unless `ENABLE_NMAP=true`. Its default command is intentionally limited and avoids aggressive flags.

To restrict launches to an allowlist, set:

```env
ALLOWED_TARGET_DOMAINS=example.com,example.org
```

Subdomains of allowlisted domains are accepted. Direct IP targets are still rejected by default.

## LAB_MODE

`LAB_MODE=true` switches the backend into a safe demo-only path for `lab/` services. In this mode:

- only targets from `ALLOWED_LAB_TARGETS` are accepted;
- an empty `ALLOWED_LAB_TARGETS` denies all lab scans;
- targets may use `host:port` such as `admin.lab.local:8088`;
- the pipeline performs only safe HTTP `GET` requests;
- findings are generated from deterministic demo markers rather than external scanner binaries.

Example env:

```env
LAB_MODE=true
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
ALLOWED_LAB_TARGETS=admin.lab.local:8088,legacy.lab.local:8088,files.lab.local:8088
```

Expected demo findings:

- `admin.lab.local:8088` -> `Exposed Admin Panel Demo`
- `legacy.lab.local:8088` -> `Legacy Service Demo`
- `files.lab.local:8088` -> `Directory Listing Demo`

## Observability

The API exposes liveness/readiness probes and Prometheus metrics:

```bash
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
curl http://localhost:8000/metrics
```

Application logs are JSON by default and are written to stdout for Docker, Loki, ELK, or cloud log collection. See `docs/observability.md` for the single-server and Kubernetes monitoring direction.

## Local Vulnerable Lab

A local-only vulnerable/demo lab is available in `lab/` for testing the SpectraScope pipeline against predictable services. It runs separately from the main backend stack and exposes only localhost-bound reverse proxy ports.

```bash
cd lab
docker compose up --build
```

See `lab/README.md` before running it. The lab contains intentionally vulnerable or suspicious demo services and must not be exposed to the internet.

The repository also contains a CI workflow for this demo loop in [`.github/workflows/lab-mode.yml`](./.github/workflows/lab-mode.yml). It starts the backend stack and lab stack, waits for `/health/ready`, launches demo scans, verifies expected findings, and uploads a JSON artifact with the results.

## Next Steps

- Add authentication, authorization, and per-user scan ownership.
- Add organization/project scoping.
- Add richer scanner result parsing and persistent deduplication rules.
- Add report export formats.
- Add integration tests with ephemeral Postgres and Redis.
