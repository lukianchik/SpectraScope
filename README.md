# SpectraScope

SpectraScope is an MVP platform skeleton for applied cyber intelligence and external attack surface analysis. A user submits a domain, the backend starts a safe discovery pipeline, stores assets and baseline findings in PostgreSQL, and exposes the results through an API.

This project is intended only for assets you own or are explicitly authorized to assess. It is not an exploitation framework or an automated pentest tool.

## Stack

- Backend: Python 3.11, FastAPI, SQLAlchemy, Alembic, Pydantic
- Queue: Redis + Celery
- Database: PostgreSQL
- Infrastructure: Docker Compose
- Scanner adapters: `subfinder`, `httpx`, `nuclei`, optional `nmap`

By default `ENABLE_REAL_SCANNERS=false`, so scanner adapters return mock results and do not execute external scanner binaries.
The mock pipeline returns dashboard-ready preview data for `example.com`: 24 assets, 15 findings, top risks, and a generated report summary.

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
- Target policy requiring explicit authorization confirmation and optional `ALLOWED_TARGET_DOMAINS` allowlist.
- Scanner adapters with normalized Python objects and safe subprocess execution: no `shell=True`, timeout handling, binary detection, and error propagation.
- Development mock mode for checking the whole flow without installing scanner tools.
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

## Next Steps

- Add authentication, authorization, and per-user scan ownership.
- Add organization/project scoping.
- Add richer scanner result parsing and persistent deduplication rules.
- Add report export formats.
- Add integration tests with ephemeral Postgres and Redis.
