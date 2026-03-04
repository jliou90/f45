# KUTM API Contract

Base URL prefix: `/api/v1`

## Auth and Tenancy Headers
- Public endpoints:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/ops/bootstrap` (requires `X-Bootstrap-Token`)
  - `GET /healthz`
  - `GET /readyz`
- Authenticated endpoints require:
  - `Authorization: Bearer <access_token>`
- Tenant-scoped endpoints require:
  - `Authorization: Bearer <access_token>`
  - `X-Tenant-Id: <tenant_uuid>`
- Write endpoints may enforce idempotency depending on env:
  - `Idempotency-Key: <opaque_key>`
  - Default policy: required for all `/api/v1` write routes outside dev
  - Default exempt routes: `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/ops/bootstrap`

## Tenancy Endpoints
- `POST /api/v1/tenants` creates a tenant and auto-creates creator membership (`admin`)
- `GET /api/v1/tenants/mine` returns paged memberships for current user
- `GET /api/v1/tenants/current` validates `X-Tenant-Id` against membership and returns tenant + role

## Error Envelope
All application and validation errors are returned as:

```json
{
  "code": "string_code",
  "message": "human readable",
  "details": {},
  "request_id": "request-id"
}
```

Examples:
- Missing auth header -> `401`, `error.code = "auth_missing"`
- Missing tenant header -> `400`, `error.code = "tenant_missing"`
- Forbidden tenant membership -> `403`, `error.code = "tenant_forbidden"`
- Validation errors -> `422`, `error.code = "validation_error"`

## Pagination Shape
Paged endpoints return:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "size": 50,
    "total": 123
  }
}
```

`meta.page` is 1-based. `size` is requested page size after server caps.

## Concurrency and ETags (DMS)
DMS entity read endpoints return `ETag` based on version. Update/delete endpoints accept `If-Match` and enforce optimistic concurrency.

## Contract Freeze Artifacts
- OpenAPI snapshot (source for generated types): `frontend/src/api/openapi.json`
- Generated frontend types: `frontend/src/api/types.ts`
