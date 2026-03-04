# Tenant Isolation Invariants

KUTM is multi-tenant. Data from tenant A must never be visible or mutable from tenant B.

## Invariants

- Tenant context must be resolved per request from `X-Tenant-Id` and validated against authenticated membership.
- Tenant-scoped data access must include an explicit tenant filter.
- Unknown tenant and unauthorized tenant membership both return `tenant_not_found` behavior to reduce tenant enumeration.
- Write endpoints require both auth and tenant context.

## Guardrails in code

- `app.core.tenancy.deps.get_current_tenant`: resolves and enforces membership.
- `app.core.tenancy.query.tenant_scoped_query(...)`: requires `tenant_id` explicitly and applies tenant filter.
- DMS endpoints use tenant-scoped helpers for read/list/update/delete.

## Regression tests

`backend/tests/test_tenant_isolation.py` includes cross-tenant read/update/delete/list coverage, including:

- create under tenant A then get/patch/delete with tenant B -> rejected
- list endpoints return only current tenant resources
- get-by-id from tenant B for tenant A resource -> rejected

If tenant filters are removed in data access, these tests should fail.
