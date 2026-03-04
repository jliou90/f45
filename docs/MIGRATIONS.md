# Migrations Discipline

KUTM migrations are managed with Alembic and must remain deterministic.

## Rules

- exactly one head in the migration graph
- every migration defines `upgrade()` and `downgrade()`
- migration scripts must run on a fresh database
- rollback path must be validated for each new revision
- non-merge migrations cannot be pass-only (`upgrade()` and `downgrade()` both `pass`)

ALLOWED_MIGRATION_HEADS=

## Standard Commands

Apply latest:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Rollback one step:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m alembic downgrade -1
```

Show current head(s):

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m alembic heads
```

Sanity gate:

```powershell
pwsh -File .\scripts\migrations-sanity.ps1
```

## Fresh DB Verification

Use the repo script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-fresh-db-migrations.ps1 -ConfirmDbName kutm
```

This script:

- checks single Alembic head
- validates downgrade functions exist
- resets schemas in the target DB
- runs `upgrade head`
- runs `downgrade -1` then `upgrade head` (unless skipped)
- runs constraint/index smoke verification when available

## Merge Conflicts / Multiple Heads

If `alembic heads` returns multiple heads:

1. create a merge migration
2. review downgrade behavior
3. rerun fresh DB verification

## Transaction Boundaries (Request Path Policy)

- request-path writes must use `UnitOfWork` (`get_uow`) as the transaction boundary
- raw `session.commit()` calls are disallowed in `backend/app` except:
  - `backend/app/core/uow.py`
  - bootstrap utility paths (currently `backend/app/modules/ops/api.py`)
- service-layer write helpers should `flush()` and let the caller-controlled UnitOfWork commit/rollback
- CI enforces this with `backend/tests/test_no_raw_commits.py`
