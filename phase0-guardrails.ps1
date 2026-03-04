# ============================
# KUTM Phase 0 - Guardrail Docs
# Creates:
#   C:\kingunderthemountain\docs\HANDOFF.md
#   C:\kingunderthemountain\docs\DIRECTORY_MAP.md
#   C:\kingunderthemountain\docs\API_INDEX.md
# ============================

$Root = "C:\kingunderthemountain"
$Docs = Join-Path $Root "docs"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $dir = Split-Path -Path $Path -Parent
  Ensure-Dir $dir
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

Ensure-Dir $Root
Ensure-Dir $Docs

# ----------------------------
# HANDOFF.md
# ----------------------------
$handoff = @"
# King Under The Mountain (KUTM) — HANDOFF

## Goal (1 paragraph)
Build an enterprise-grade, modular, LAN-first dealership DMS platform with a FastAPI backend and a lightweight web UI. The project must be durable on dealership-grade Windows PCs, avoid “big-session” dev friction, and remain maintainable as it grows into thousands of files.

## Non-negotiables
- Windows + LAN first (dealership reality).
- Modular “vertical slice” architecture: easy to find/edit features later.
- Auth: login + refresh (JWT), passwords never stored in plaintext.
- Tenant create/select + tenant context.
- Roles/permissions skeleton + enforcement hook (Casbin).
- Audit logging middleware (PII-safe).
- Health/version endpoints.
- Minimal UI shell + sign-in screen (later).
- Strict guardrails to prevent naming/import mistakes.

## Tech decisions (locked)
- Backend: FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic + Postgres
- Auth (v0.1): internal JWT (replaceable by OIDC later)
- RBAC engine: Casbin (don’t hand-roll permissions)
- Tests: pytest
- Security tooling: bandit + pip-audit
- Frontend: React + TypeScript (Vite), Tailwind + shadcn/ui (planned)
- Ops: Docker Compose for Postgres (Windows host)

## Repository layout (top-level)
- backend/        FastAPI API (source of truth)
- frontend/       UI (later; keep minimal)
- infra/          docker-compose, ops scripts, service installs
- docs/           HANDOFF, DIRECTORY_MAP, API_INDEX, ADRs
- scripts/        one-liner dev helpers
- tools/          security/compliance docs, lint config, pre-commit

## Current state (update each session)
- Date:
- What works:
- What’s broken:
- Known risks:

## Last session changes (update each session)
- Files touched:
- Migrations:
- Behavior changes:

## Next 5 tasks (always keep current)
1.
2.
3.
4.
5.

## “Don’t lose this” notes
- Postgres password lives in backend .env (never hardcode in code).
- All routers must be registered in the single router registry file.
- If an endpoint “disappears,” run routing smoke tests first.
- Keep responses small: patch-style edits, 1–3 files at a time.
"@

Write-Utf8NoBom (Join-Path $Docs "HANDOFF.md") $handoff

# ----------------------------
# DIRECTORY_MAP.md
# ----------------------------
$dirMap = @"
# KUTM — DIRECTORY_MAP (Canonical)

This file defines the ONLY approved places to put code. If you follow this map,
you will not lose hours to naming/import mistakes.

## Root
- backend/   : FastAPI API, modules, migrations, tests (source of truth)
- frontend/  : React UI (minimal; keep lightweight)
- infra/     : docker compose, service scripts, ops notes
- docs/      : reference docs, ADRs, handoff
- scripts/   : dev helpers (run, lint, test)
- tools/     : security/compliance, lint rules, pre-commit

## Backend canonical layout (vertical slice modules)
backend/
  app/
    main.py                 # FastAPI create_app + include router registry
    router.py               # SINGLE router registry (imports every module router)
    core/                   # settings, security, logging, errors
    db/                     # engine/session, base, migrations hooks
    middleware/             # request id, audit, tenant context
    modules/
      <module_name>/
        __init__.py
        api.py              # FastAPI router (endpoints)
        models.py           # SQLAlchemy models
        schemas.py          # Pydantic request/response models
        service.py          # business logic
        deps.py             # FastAPI dependencies (auth guards, tenant context)
        policy.py           # permissions (Casbin integration)
        tests/              # module-level tests

## Canonical foundation modules (must exist early)
- modules/identity/   : login/refresh, user model, password hashing (never plaintext)
- modules/tenancy/    : tenants + selection + tenant context
- modules/rbac/       : Casbin integration wrapper (roles/permissions)
- modules/audit/      : audit log model + search endpoint (admin only)
- modules/health/     : /health and /version

## Naming rules (do not deviate)
- Module folder: snake_case singular (identity, tenancy, vehicle, appointment)
- Router files are ALWAYS: api.py
- Models files are ALWAYS: models.py
- Schemas files are ALWAYS: schemas.py
- Business logic ALWAYS: service.py
- Dependencies ALWAYS: deps.py
- Permissions ALWAYS: policy.py
- No “misc.py”, no “utils.py” dumping grounds inside modules.

## Router registration rule (the biggest guardrail)
- All routers MUST be imported and registered in: backend/app/router.py
- If a route isn’t registered there, it does not exist.
- Renames MUST update router.py and API_INDEX.md.

## Testing guardrails
- backend/tests/test_routes_smoke.py MUST assert critical endpoints exist:
  /health, /version, /auth/login, /auth/refresh, etc.
- Run tests before assuming a “mystery bug.”
"@

Write-Utf8NoBom (Join-Path $Docs "DIRECTORY_MAP.md") $dirMap

# ----------------------------
# API_INDEX.md
# ----------------------------
$apiIndex = @"
# KUTM — API_INDEX (Endpoint → Source)

This is the map from URL endpoints to the exact file that defines them.
Update it whenever you add/move/rename routers.

## Foundation
- GET  /health              → backend/app/modules/health/api.py
- GET  /version             → backend/app/modules/health/api.py

## Auth (Identity)
- POST /auth/login          → backend/app/modules/identity/api.py
- POST /auth/refresh        → backend/app/modules/identity/api.py

## Tenancy
- GET  /tenants             → backend/app/modules/tenancy/api.py
- POST /tenants             → backend/app/modules/tenancy/api.py
- POST /tenants/select      → backend/app/modules/tenancy/api.py

## RBAC
- GET  /rbac/roles          → backend/app/modules/rbac/api.py
- GET  /rbac/permissions    → backend/app/modules/rbac/api.py

## Audit
- GET  /audit               → backend/app/modules/audit/api.py

## Notes
- The SINGLE router registry must be: backend/app/router.py
- If an endpoint “vanishes,” check router.py imports first.
"@

Write-Utf8NoBom (Join-Path $Docs "API_INDEX.md") $apiIndex

Write-Host "✅ Phase 0 guardrail docs created:"
Write-Host " - $Docs\HANDOFF.md"
Write-Host " - $Docs\DIRECTORY_MAP.md"
Write-Host " - $Docs\API_INDEX.md"
