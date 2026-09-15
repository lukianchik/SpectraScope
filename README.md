# SpectraScope

**English** · [Русский](README.ru.md)

[![Backend](https://github.com/lukianchik/SpectraScope/actions/workflows/backend.yml/badge.svg)](https://github.com/lukianchik/SpectraScope/actions/workflows/backend.yml)
[![Frontend](https://github.com/lukianchik/SpectraScope/actions/workflows/frontend.yml/badge.svg)](https://github.com/lukianchik/SpectraScope/actions/workflows/frontend.yml)
[![Product smoke](https://github.com/lukianchik/SpectraScope/actions/workflows/compose-smoke.yml/badge.svg)](https://github.com/lukianchik/SpectraScope/actions/workflows/compose-smoke.yml)
[![Security](https://github.com/lukianchik/SpectraScope/actions/workflows/security.yml/badge.svg)](https://github.com/lukianchik/SpectraScope/actions/workflows/security.yml)
[![MIT](https://img.shields.io/badge/license-MIT-4ee0c5.svg)](LICENSE)

Safe-by-default external attack-surface analysis for authorized targets. SpectraScope discovers assets, normalizes scanner findings and turns them into prioritized reports.

![SpectraScope interface](docs/spectrascope-preview.png)

> [!IMPORTANT]
> Use SpectraScope only on systems you own or are explicitly authorized to assess. Real scanners are disabled by default and require an allowlist.

## Highlights

- React 19 and TypeScript interface with dashboards, triage and report exports.
- FastAPI API, PostgreSQL persistence and Celery/Redis background jobs.
- Safe adapters for subfinder, httpx, nuclei and optional bounded nmap.
- Target validation, authorization records and DNS/IP scope enforcement.
- Signed HttpOnly sessions, encrypted integration settings and production safety checks.
- Prometheus metrics, health probes and Docker-based CI smoke tests.

## Quick start

Requirements: Docker Engine or Docker Desktop with Compose v2.

~~~bash
git clone https://github.com/lukianchik/SpectraScope.git
cd SpectraScope
docker compose up --build
~~~

Open:

- UI — <http://localhost:3000>
- API docs — <http://localhost:8000/docs>
- readiness — <http://localhost:8000/health/ready>

The default stack uses deterministic preview findings. The API, database, queue, worker and UI remain fully functional; only external scanner execution is simulated.

## Architecture

    React UI → nginx → FastAPI → PostgreSQL
                           ↓
                         Redis → Celery worker → scanner adapters

## Modes

| Mode | Use |
| --- | --- |
| Preview | Deterministic demonstration without external scanner execution |
| LAB_MODE | HTTP checks against allowlisted local demo services |
| Local real | Real scanners restricted to the bundled lab |
| Real | Explicitly enabled scanners restricted by ALLOWED_TARGET_DOMAINS |

Scanner setup and restrictions are documented in [docs/scanner-commands.md](docs/scanner-commands.md). Production requirements are in [docs/operations.md](docs/operations.md).

## Development and checks

~~~bash
# backend
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend pytest -q
python -m pip_audit -r backend/requirements.txt

# frontend
cd frontend
bun install --frozen-lockfile
bun run lint
bun run build
bun audit --audit-level=high
~~~

Complete product smoke:

~~~bash
docker compose up -d --build
python ops/compose_smoke_ci.py
~~~

## Research disclaimer

SpectraScope is an experimental learning and research project developed with AI-assisted tools. It is provided as-is and makes no claim of completeness, professional certification or fitness for production use. Internet-facing deployment requires TLS, unique secrets, backups, retention rules and an independent security review. See [SECURITY.md](SECURITY.md).

Licensed under [MIT](LICENSE).
