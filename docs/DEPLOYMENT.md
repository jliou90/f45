# Deployment Runbook

This runbook describes a baseline deployment for the KUTM backend (`FastAPI + SQLAlchemy + Alembic + Postgres`).

For the LAN single-origin HTTPS pilot (`https://kutm.local`), use:

- `docs/lan-deploy.md`
- `scripts/lan-up.ps1`
- `scripts/lan-down.ps1`

## 1. Prerequisites

- Windows PowerShell 7+ (or PowerShell 5.1)
- Docker Desktop (recommended) or reachable Postgres
- Python 3.12 (project baseline runtime)
- Python virtualenv at `backend/.venv`
- Config file `backend/.env` populated from `backend/.env.example`

## 2. Environment Checklist

Required minimums:

- `ENV=prod` for production posture
- Strong `JWT_SECRET` (>= 32 chars)
- Strong `BOOTSTRAP_TOKEN` if bootstrap is enabled
- Valid Postgres configuration (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- `KUTM_IDEMPOTENCY_ENFORCE=1` (recommended for production writes)
- `UVICORN_WORKERS` set for expected concurrency (start at `4`, increase per CPU/load-test results)
- `KUTM_DMS_REQUIRE_IF_MATCH=1` to enforce optimistic concurrency on DMS edits
- `KUTM_RATE_LIMIT_BACKEND=auto` (uses Postgres-backed shared windows when available)
- DB pool sizing tuned for concurrency (`KUTM_DB_POOL_SIZE`, `KUTM_DB_MAX_OVERFLOW`, `KUTM_DB_POOL_TIMEOUT_SECONDS`, `KUTM_DB_POOL_RECYCLE_SECONDS`)

Optional but recommended:

- `APP_VERSION`
- `GIT_SHA`
- `BUILD_TIME`
- `TRUSTED_HOSTS`
- `KUTM_IDEMPOTENCY_EXEMPT_PATHS` if you need non-default write exemptions
- verify `/api/v1/ops/version` reports expected build metadata after deployment

## 3. Database Migration

From repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\migrate.ps1
```

If Postgres is not already running, start/verify it first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ensure-postgres.ps1
```

## 4. Docker Compose Deployment

Copy `.env.example` to `.env` at repo root and adjust values.

Start API + Postgres:

```powershell
docker compose up --build
```

Start with optional pgAdmin:

```powershell
docker compose --profile dev up --build
```

Health checks:

- `GET http://127.0.0.1:8010/health`
- `GET http://127.0.0.1:8010/api/v1/ops/health`

## 5. Start API (non-container)

Dev-style start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

If using your own process manager, start with:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --workers 4
```

## 6. Post-Deploy Checks

- `GET /health`
- `GET /readyz`
- `GET /api/v1/ops/health`
- `GET /metrics`

`/readyz` now validates DB connectivity and returns `503` when dependencies are unavailable.
- run SLO drill evidence capture:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-slo-drill.ps1
```

### Install Smoke Verification

Run deterministic install flow validation (bootstrap -> login -> tenant -> domain write):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-install.ps1
```

This command:

- applies Alembic migrations to head
- runs `backend/tests/test_install_smoke.py`
- validates first-install flow end-to-end on a fresh app state

## 7. Bootstrap User/Tenant (first install only)

When `BOOTSTRAP_TOKEN` is set, call:

`POST /api/v1/ops/bootstrap` with header `X-Bootstrap-Token: <token>`

Payload:

```json
{
  "email": "admin@example.com",
  "password": "StrongPassword123!",
  "tenant_name": "Default"
}
```

After bootstrap:

- store credentials in a secrets manager
- remove/rotate bootstrap token

## 8. Rollback

- Application rollback: deploy previous app artifact
- Database rollback: run alembic downgrade step only if migration is reversible and impact is understood
- Last-resort rollback: restore database from backup (`docs/BACKUP_RESTORE.md`)
- Baseline anchor for known-good code state: `v0.1.0-baseline`
  - `git checkout v0.1.0-baseline`
  - rebuild/redeploy from that tag when a release rollback is required

## 9. Clean Host Validation

Validate end-to-end deploy assumptions on a clean environment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-clean-deploy.ps1
```

This command verifies dependency install, DB reachability, migrations, app boot, and install smoke flow.

## 10. Production Security Gate

Before production release, verify `.env` posture:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-prod-security.ps1 -EnvFile .\backend\.env
```
