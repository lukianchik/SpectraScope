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
  -d '{"target":"example.com","scan_profile":"safe"}'
```

Then use the returned `id`:

```bash
curl http://localhost:8000/api/scans/<scan_id>
curl http://localhost:8000/api/scans/<scan_id>/assets
curl http://localhost:8000/api/scans/<scan_id>/findings
curl http://localhost:8000/api/scans/<scan_id>/report
```

## MVP Scope

- FastAPI app with health, scan start, scan status, assets, findings, and report endpoints.
- SQLAlchemy models and Alembic initial migration for scans, assets, services, findings, and risk reports.
- Celery worker task `run_scan(scan_id)` with a safe scanner pipeline.
- Target validation that accepts domains and rejects direct IP targets by default.
- Scanner adapters with normalized Python objects and safe subprocess execution: no `shell=True`, timeout handling, binary detection, and error propagation.
- Development mock mode for checking the whole flow without installing scanner tools.
- Docker Compose services for backend, worker, Postgres, and Redis.

## Scanner Safety

Real scanner execution is opt-in with:

```env
ENABLE_REAL_SCANNERS=true
```

The initial `nmap` adapter is disabled unless `ENABLE_NMAP=true`. Its default command is intentionally limited and avoids aggressive flags.

## Next Steps

- Add authentication, authorization, and per-user scan ownership.
- Add organization/project scoping and an allowlist policy for approved targets.
- Add richer scanner result parsing and deduplication.
- Add API pagination, filtering, and report export formats.
- Add frontend React/Vite application in `frontend/`.
- Add integration tests with ephemeral Postgres and Redis.
