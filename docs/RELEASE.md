# Release Process

This document defines patch-level Definition of Done and release steps for KUTM backend.

Canonical frontend location for release builds is `frontend/`. Legacy `kutm-frontend/` is archived under `attic/` and not built.

## Definition of Done (Patch)

A patch is shippable only when all checks below pass:

- code compiles and local tests pass (`pytest`)
- migrations are deterministic and runnable on fresh DB
- migration graph has one head
- downgrade path exists for new migration
- API compatibility is preserved (or explicitly versioned)
- operational docs updated when behavior changes
- security-sensitive outputs are sanitized

Release evidence that must stay current:

- Tenant scoping checklist for write endpoints:
  - `docs/release/TENANT_SCOPING_CHECKLIST.md`
- Pagination/filtering consistency matrix:
  - `docs/release/PAGINATION_MATRIX.md`

## Release Cut Checklist

1. Set release metadata:
   - `APP_VERSION` (SemVer)
   - `GIT_SHA`
   - `BUILD_TIME` (UTC ISO8601)
2. Run CI and ensure all required jobs pass.
   - `.github/workflows/ci.yml` (PR gates on Python 3.12)
   - `.github/workflows/release-promotion.yml` (dev -> staging -> prod)
3. Run local smoke checks:
   - `GET /health`
   - `GET /api/v1/ops/health`
   - `GET /api/v1/ops/version`
   - `GET /api/v1/ops/diag` (authorized)
4. Update `CHANGELOG.md`:
   - move unreleased items into the release section
   - include migration notes and rollback considerations
5. Tag and publish:
   - create git tag `vX.Y.Z`
   - publish release artifact/container image
6. Post-release verification:
   - confirm health/metrics
   - verify auth login/refresh flow
   - verify at least one tenant-scoped read/write path
   - confirm rollback guard succeeded (alembic downgrade/upgrade step in promotion workflow)

## Deterministic CI Gate Block

Run these from repo root to mirror the required release gates in deterministic order:

```powershell
# --- Backend quality gates ---
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend
.\backend\.venv\Scripts\python.exe -m ruff check .\backend\app .\backend\tests
.\backend\.venv\Scripts\python.exe -m mypy .\backend\app

# --- Contract + API consistency ---
.\backend\.venv\Scripts\python.exe .\backend\tools\check_contract_refs.py
.\backend\.venv\Scripts\python.exe .\backend\tools\check_api_index.py
.\backend\.venv\Scripts\python.exe .\backend\tools\export_openapi.py --out .\frontend\src\api\openapi.json --check
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_e2e_auth_tenant_write_smoke.py

# --- Frontend deterministic contract generation ---
cd .\frontend
npm ci
npm run gen:api
npm run typecheck
npm run lint
npm run test
npm run build
```

Notes:
- `npm run gen:api` is deterministic and reads `frontend/src/api/openapi.json`.
- Use `npm run gen:api:live` only when you intentionally want to regenerate from a running backend.
