# Troubleshooting Runbook

## API Does Not Start

Checks:

- `backend/.env` exists and has required values
- `JWT_SECRET` and `BOOTSTRAP_TOKEN` meet production requirements in `ENV=prod`
- Postgres is reachable

Commands:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\migrate.ps1
```

## Migration Failures

Symptoms:

- Alembic upgrade fails
- Multiple migration heads

Recovery:

1. run `alembic heads`
2. ensure a single head
3. run fresh DB verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-fresh-db-migrations.ps1 -ConfirmDbName kutm
```

## Docker / Postgres Bring-up Issues

Symptoms:

- `docker compose` returns engine API errors
- backend scripts fail with Postgres unreachable

Recovery:

1. run `docker version` and verify both client/server return successfully
2. run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ensure-postgres.ps1
```

3. retry `scripts\migrate.ps1` or `scripts\dev.ps1`

## Auth Issues (401 on refresh/login)

Checks:

- refresh token replay protection may reject reused token
- disabled users cannot login/refresh
- password change revokes prior refresh tokens

## Metrics Missing

Checks:

- `/metrics` endpoint reachable
- observability middleware registered
- logs include `request_id` and `correlation_id`

## Rate Limit Unexpected 429

Checks:

- `KUTM_RATE_LIMIT_ENABLED`
- `KUTM_RATE_LIMIT_PER_MIN`
- tenant header presence (`X-Tenant-Id`) for tenant-scoped writes
