# KUTM â€” DIRECTORY_MAP (Canonical)

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
- No â€œmisc.pyâ€, no â€œutils.pyâ€ dumping grounds inside modules.

## Router registration rule (the biggest guardrail)
- All routers MUST be imported and registered in: backend/app/router.py
- If a route isnâ€™t registered there, it does not exist.
- Renames MUST update router.py and API_INDEX.md.

## Testing guardrails
- backend/tests/test_routes_smoke.py MUST assert critical endpoints exist:
  /health, /version, /api/v1/auth/login, /api/v1/auth/refresh, etc.
- Run tests before assuming a â€œmystery bug.â€
