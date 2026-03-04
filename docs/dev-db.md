# Dev DB: Fresh Migration Verification (No CREATEDB)

This workflow verifies `alembic upgrade head` from a clean state without creating/dropping databases.

It uses the database configured in `backend/.env` (`DB_NAME`) and resets only KUTM-owned schemas:
- `public`
- `acct`
- `events`
- `readmodels`
- `platform`

## Prereqs

1. Docker is running.
2. `backend/.venv` exists and has Alembic installed.
3. `backend/.env` exists (copy from `backend/.env.example` if needed).
4. Target database already exists (default from `infra/docker-compose.yml`: `kutm`).

## Commands

Start Postgres:

```powershell
docker compose -f .\infra\docker-compose.yml up -d postgres
```

Run fresh migration verification against the configured DB (`DB_NAME` in `backend/.env`):

```powershell
.\scripts\verify-fresh-db-migrations.ps1 -ConfirmDbName kutm
```

If `DB_NAME` is not `kutm`, pass that exact value to `-ConfirmDbName`:

```powershell
.\scripts\verify-fresh-db-migrations.ps1 -ConfirmDbName kutm_verify
```

Skip compose startup if Postgres is already running:

```powershell
.\scripts\verify-fresh-db-migrations.ps1 -ConfirmDbName kutm -SkipComposeUp

# One-command proof (migrations + constraint/index smoke query)
.\scripts\fresh-db-smoke.ps1 -ConfirmDbName kutm
```

## Notes

- The script does **not** create databases, so `CREATEDB` is not required.
- Safety check: destructive schema reset runs only when `-ConfirmDbName` exactly matches `DB_NAME` from `backend/.env`.
- The script drops/recreates KUTM schemas inside that database; do not run it against a DB with data you need.
