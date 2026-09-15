# SpectraScope operations guide

## Production preparation

1. Copy `.env.production.example` to `.env`.
2. Generate the admin password hash:

   ```powershell
   py scripts/generate_password_hash.py
   ```

3. Generate independent random values for `POSTGRES_PASSWORD`, `SESSION_SECRET` and `INTEGRATION_SECRET_KEY`. Do not reuse them.
4. Replace the public origin in `CORS_ALLOWED_ORIGINS` and set the matching database URL.
5. Validate the resolved configuration:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
   ```

6. Start the localhost-bound service:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
   ```

7. Terminate HTTPS with a maintained reverse proxy or ingress in front of `127.0.0.1:3000`. Do not expose the HTTP bind directly to the internet.

Production configuration intentionally refuses to start when authentication, secure cookies or encryption keys are unsafe. PostgreSQL and Redis ports are removed by the production override.

## Upgrade and rollback

Before an upgrade, create and verify a backup. Pull/build immutable images, run `alembic upgrade head` as part of the backend startup, execute the smoke test, and retain the previous image tags until verification completes. Database rollback requires a compatible backup; do not assume every migration downgrade is lossless.

## Backup

Create a plain SQL backup from the running database:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec -T postgres pg_dump -U spectrascope -d spectrascope --clean --if-exists > backups/spectrascope.sql
```

Store backups encrypted outside the application host and apply a retention policy. A backup is not valid until it has been restored into an isolated database and checked.

## Restore drill

Stop API/worker writes, create an isolated PostgreSQL instance, and restore with:

```powershell
Get-Content backups/spectrascope.sql -Raw | docker compose exec -T postgres psql -U spectrascope -d spectrascope
```

Then run migrations, `/health/ready`, a read-only API check, and a test scan. Never overwrite the only production database during a drill.

## Incident checks

- `/health/live`: API process liveness.
- `/health/ready`: PostgreSQL and Redis readiness.
- `/metrics`: Prometheus metrics.
- `/api/monitoring/summary`: product counts and queue state.
- `docker compose logs backend worker`: correlated JSON logs with request/stage information.

For queue backlog, stop new scan launches, preserve logs and database state, check Redis/worker health, and only then restart a worker. For a suspected credential leak, rotate the affected secret, session secret and integration key; encrypted integration credentials must then be entered again.
