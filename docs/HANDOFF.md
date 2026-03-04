# King Under The Mountain (KUTM) - HANDOFF

## Goal (1 paragraph)
Build an enterprise-grade, modular, LAN-first dealership DMS platform with a FastAPI backend and a web shell that can run reliably on dealership-grade Windows machines. The codebase should remain easy to navigate at scale, enforce tenancy and RBAC consistently, and ship with operational guardrails (migrations, observability, security posture, and release checks).

## Non-negotiables
- Windows + LAN first.
- Vertical-slice modular architecture.
- Auth: login + refresh JWT; no plaintext passwords.
- Tenant create/select + enforced tenant context.
- RBAC enforcement on protected surfaces.
- Audit logging for write paths.
- Health/version/ops endpoints.
- CI gates for migrations, contract drift, and security tooling.

## Tech decisions (locked)
- Backend: FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic + Postgres
- Auth: internal JWT (OIDC-compatible migration path later)
- Tests: pytest
- Security tooling: bandit + pip-audit
- Frontend: React + TypeScript (Vite)
- Ops: Docker Compose + local supervisor/control panel components

## Repository layout (top-level)
- `backend/` API service and migrations
- `frontend/` canonical frontend for build and release
- `supervisor/` local control-plane API
- `control_panel/` Windows service + tray
- `infra/` compose/monitoring
- `docs/` runbooks and architecture docs
- `scripts/` developer and release scripts
- `attic/` archived, non-shipped components

## Current state (2026-03-03)
- What works:
  - API and frontend both have automated test coverage and CI gates.
  - Tenant context and role checks are centrally enforced.
  - Contract drift and migration determinism checks are wired into CI.
  - Audit middleware now supports semantic tag fallback plus explicit field overrides.
- What's broken or incomplete:
  - Repository is still in bootstrap phase with a very large active working set.
  - Some module surfaces remain scaffold placeholders and are now gated behind a disabled-by-default feature flag.
  - Realtime stub endpoint exists but is disabled by default.
- Known risks:
  - Large concurrent change surface can still increase merge/review risk.
  - Type checking remains incremental (strict lane expanded but not universal strict mode).

## Last session changes
- Files touched:
  - Audit middleware fallback behavior, ops feature flags/stub gating
  - Scaffold plugin gating in frontend
  - Type safety and CI typing lane hardening
  - Release and handoff documentation hygiene
- Migrations:
  - None
- Behavior changes:
  - `audit_tag` metadata is now consumed by audit middleware when explicit fields are absent.
  - Scaffold module plugins are hidden unless `scaffoldEnabled=true`.
  - `/api/v1/ops/events` is hidden from schema and returns 404 unless explicitly enabled.

## Next 5 tasks
1. Finish tenant write-path audit evidence per module and keep it updated each release.
2. Continue reducing scaffold placeholders by replacing with real domain flows.
3. Expand strict mypy coverage to additional modules (`admin`, `deals`, `inventory`, `funding`).
4. Add release branch policy for smaller, reviewable PR slices.
5. Add runtime SLO dashboards and alert drill playbooks for pilot environments.

## Don't lose this
- Do not commit secrets or local env files.
- Keep API routing centralized in `backend/app/router/api.py`.
- Keep docs in sync when routes/behavior change.
- Run migration and contract checks before cutting release artifacts.
