# Tenant Scoping Checklist

Purpose: release-time evidence that tenant-scoped write surfaces enforce tenant context and membership validation.

## Control points
- Router composition applies tenant dependency for tenant-scoped modules:
  - `backend/app/router/api.py`
- Tenant resolution and membership check:
  - `backend/app/core/tenancy/deps.py`
- Tenant-aware query helpers used by data access paths:
  - `backend/app/core/tenancy/query.py`

## Write surfaces audited
- DMS writes (`/api/v1/dms/*`): tenant dependency + tenant-scoped queries.
- Deals writes (`/api/v1/deals/*`): tenant dependency + tenant-scoped document access.
- Inventory writes (`/api/v1/inventory/*`): tenant dependency + tenant-scoped document access.
- Funding writes (`/api/v1/funding/*`): tenant dependency + tenant-scoped document access.
- Service RO writes (`/api/v1/service/*`): tenant dependency + tenant-scoped document access.
- Admin writes (`/api/v1/admin/*`): tenant dependency + admin role guard.
- Integrations writes (`/api/v1/integrations/*`): tenant dependency + permission guard.

## Verification artifacts
- `backend/tests/test_tenant_isolation.py`
- `backend/tests/test_tenancy_enforcement_patch_a2.py`
- `backend/tests/test_e2e_auth_tenant_write_smoke.py`
- `backend/tests/test_rbac_permissions_patch_a3.py`

## Release sign-off
- [ ] Route composition unchanged or re-audited.
- [ ] New write endpoints added to this checklist.
- [ ] Tenant isolation tests pass in CI.
