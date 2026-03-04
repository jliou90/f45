# KUTM Frontend Contract (Frozen)

This document defines the backend contract the React client must follow.

## 1. Auth + Tenant Boot Flow

1. `POST /api/v1/auth/login` with credentials.
2. Store `access_token` (Bearer) and `refresh_token`.
3. `GET /api/v1/auth/me` with `Authorization: Bearer <access_token>`.
4. `GET /api/v1/tenants/mine` with `Authorization` to fetch memberships.
5. User selects tenant.
6. For tenant-scoped APIs, send both:
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_uuid>`

## 2. Required Headers By Request Type

- Public health/version: none.
- Authenticated non-tenant routes (`/auth/*`, `/tenants/mine`): `Authorization`.
- Tenant-scoped reads: `Authorization`, `X-Tenant-Id`.
- Tenant-scoped writes (`POST|PUT|PATCH|DELETE`):
- `Authorization`
- `X-Tenant-Id`
- `Idempotency-Key` (unique per logical mutation attempt)

Notes:
- `Idempotency-Key` is required for write requests by policy. `login`, `refresh`, and `ops/bootstrap` are explicit exemptions from header requirement.
- Re-using an idempotency key for a different payload returns conflict.

## 3. Error Envelope + Request ID

All errors use the same shape:

```json
{
  "code": "string",
  "message": "string",
  "details": {},
  "request_id": "string|null"
}
```

Behavior:
- Every response includes `X-Request-Id`.
- `request_id` in the JSON error body matches `X-Request-Id`.
- Frontend should log/display `request_id` for support/debug correlation.

## 4. Collection/Pagination Contract

All list endpoints return:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "size": 25,
    "total": 0
  }
}
```

Query conventions:
- `page`: 1-based integer (`>=1`)
- `size`: integer (`>=1`, endpoint max enforced)
- `sort`: comma-separated fields, `-` prefix for descending.
- Example: `sort=updated_at,-version`

## 5. Workflow Entities Contract

Workflow entity GET-by-id responses include:
- document payload
- `allowed_actions: string[]`

Client behavior:
- Render action buttons from `allowed_actions` only.
- Transition mutation endpoints still validate server-side and can return transition-invalid errors.

## 6. Documents/Attachments Contract

Attachment metadata shape:
- `id`
- `filename`
- `mime_type`
- `size`
- `sha256`
- `created_at`
- `created_by`
- `tenant_id`

Conventions:
- Upload returns metadata immediately.
- Download streams binary by attachment id.
- Entity linking uses explicit association endpoints with:
- `entity_type` (e.g., `deal`, `service_ro`)
- `entity_id`
- `attachment_id`

## 7. Jobs (Async Pattern)

Pattern:
- `POST /api/v1/jobs/{type}` creates a job and returns `job_id` + initial status.
- `GET /api/v1/jobs/{job_id}` returns current:
- `status` (`queued|running|succeeded|failed`)
- `progress` (0..100)
- `result` (optional JSON)
- `error` (optional object/string)

Client behavior:
- Poll `GET /jobs/{job_id}` until terminal state (`succeeded|failed`).
- Keep optimistic UI separate from terminal job result.
