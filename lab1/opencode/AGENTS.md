# SpectraScope agent guide

## Purpose and safety boundary

SpectraScope is a safe-by-default external attack-surface analysis platform. Work only with targets the user owns or is explicitly authorized to assess. Never weaken target authorization, allowlists, network-policy checks, authentication, or the default-disabled real-scanner mode to make a test pass.

Do not commit credentials, real customer targets, raw scanner evidence, database dumps, or generated reports containing sensitive targets. Keep the bundled vulnerable lab on a trusted local network only.

## Repository map

- `backend/app/api`: FastAPI routes and API error mapping.
- `backend/app/services`: target policy, network policy, scan profiles, orchestration, integrations, and workspace settings.
- `backend/app/scanners`: bounded adapters for subfinder, httpx, nuclei, and nmap.
- `backend/app/workers`: Celery application and tasks.
- `backend/app/models`, `backend/app/schemas`: SQLAlchemy persistence and Pydantic API contracts.
- `backend/alembic`: database migrations.
- `frontend/src`: React 19 and TypeScript UI.
- `tests`: backend unit and API tests.
- `ops`: smoke checks and operational helpers.
- `lab`: intentionally vulnerable local services and lab-only templates.

The main runtime path is React UI -> nginx -> FastAPI -> PostgreSQL, with Redis -> Celery worker -> scanner adapters for background scans.

## Development commands

Use the repository root unless a command says otherwise.

```powershell
# Backend
pip install -r backend/requirements-dev.txt
$env:PYTHONPATH = "backend"
pytest -q
python -m pip_audit -r backend/requirements.txt

# Frontend
bun install --cwd frontend --frozen-lockfile
bun run --cwd frontend lint
bun run --cwd frontend build

# Full product smoke (requires Docker Desktop)
docker compose up -d --build
py -3 ops/compose_smoke_ci.py
```

For focused backend verification, run the closest test module first, then the complete `pytest -q` suite. Scanner or policy changes require tests for allowed and rejected targets and for affected runtime modes.

## Implementation conventions

- Keep FastAPI routes thin; put reusable decisions in `backend/app/services`.
- Validate and normalize untrusted targets before persistence or execution.
- Reuse `authorize_target`, `validate_scan_profile_for_settings`, and `validate_external_network_targets`; do not duplicate or bypass them.
- Prefer deterministic preview behavior. Any path advertised as preview or dry-run must not perform DNS, HTTP, subprocess, scanner, Celery, or other network side effects.
- Treat unavailable policy/configuration as an error in real-scanner paths; do not fail open.
- Preserve API error codes and response schemas when changing route behavior.
- Add an Alembic migration for persistent schema changes.
- Keep frontend API types and loading/error/empty states aligned with backend contracts.
- Follow the style already present in neighboring files. Do not make unrelated formatting or dependency changes.

## Completion checklist

- Relevant focused tests pass, followed by the full backend suite for backend changes.
- Frontend changes pass lint and build.
- Scanner changes document authorization and network-scope impact.
- No secrets, real targets, generated evidence, or unrelated user files are added.
- Report commands that could not run because an external service such as Docker was unavailable.
