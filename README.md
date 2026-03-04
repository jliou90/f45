# King Under The Mountain (KUTM) - DMS

**Goal:** Enterprise-grade, modular DMS for dealership LAN/Windows environments.

## Current Stack
- Backend: FastAPI + PostgreSQL + SQLAlchemy + Alembic
- Frontend: React + TypeScript (Vite)
- Security: bcrypt password hashing, JWT access+refresh, audit middleware stub
- Tooling: pytest, ruff, mypy, bandit, pip-audit

## Quick Start (Dev)
Canonical bootstrap instructions: `docs/QUICKSTART.md`

### Backend (canonical, one command)
From repo root:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

### Docker Compose (API + Postgres)
From repo root:
```powershell
docker compose up --build
```

What this does:
- Creates `backend\.env` from `backend\.env.example` if missing
- Creates `backend\.venv` if missing and installs dependencies
- Starts Postgres via Docker Compose if DB is unreachable (or uses local Postgres if already running)
- Runs `alembic upgrade head`
- Runs deterministic seed (`backend\seed_admin.py`)
- Starts API on `http://127.0.0.1:8010`
- Runs API smoke checks (`backend\tools\smoke_api.ps1`)
- Uses default dev creds `you@example.com` / `Password123!` unless env overrides are set

### Frontend
```powershell
cd .\frontend
npm run dev
```

### Freeze API Contract + Regenerate Frontend Types
From repo root:
```powershell
.\backend\.venv\Scripts\python.exe .\backend\tools\export_openapi.py --out .\frontend\src\api\openapi.json
cd .\frontend
npm run api:types
```

## Docs to ALWAYS Maintain
- docs/HANDOFF.md (resume button)
- docs/DIRECTORY_MAP.md (where files go)
- docs/API_INDEX.md (endpoint -> file map)
- docs/FRONTEND_IGNITION_KIT.md (frontend auth/tenancy/contracts quickstart)

## Operations Runbooks
- docs/DEPLOYMENT.md
- docs/BACKUP_RESTORE.md
- docs/MIGRATIONS.md
- docs/TROUBLESHOOTING.md

## Notes
- **Never** hardcode secrets in code. Use `backend/.env`
- Passwords are stored hashed (bcrypt) only
- Keep changes modular: each feature lives in its module folder

## No Docker (Local Postgres)
If Docker Desktop cannot run on this machine (virtualization disabled), install PostgreSQL locally and run Postgres as a Windows service.

Set these in `backend\.env` (example):
- DB_HOST=127.0.0.1
- DB_PORT=5440 (or 5432; match your Postgres port)
- DB_NAME=kutm
- DB_USER=kutm
- DB_PASSWORD=your_password

Then run:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -SkipComposeUp
```
