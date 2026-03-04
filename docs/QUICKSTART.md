# Quickstart (Deterministic Dev Bootstrap)

## 1) Bootstrap dependencies

From repo root:

```powershell
pwsh -File .\scripts\dev-bootstrap.ps1
```

What it does:

- validates `git`, `docker`, `docker compose`, `node`, `python`
- runs `npm ci` in `frontend/`
- creates `backend/.venv` and installs `backend/requirements.txt`
- runs a backend import smoke check

## 2) Start stack

```powershell
docker compose up -d postgres api web supervisor
```

## 3) Run frontend dev server

```powershell
Set-Location .\frontend
npm run dev
```

## 4) Optional smoke checks

```powershell
pwsh -File .\scripts\repo-sanity.ps1
pwsh -File .\scripts\migrations-sanity.ps1
pwsh -File .\scripts\appliance-smoke-test.ps1
```
