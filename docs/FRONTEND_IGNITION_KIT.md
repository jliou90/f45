# Frontend Ignition Kit

Base API prefix: `/api/v1`

## System Overview
- Identity/Auth: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Tenancy: `GET /api/v1/tenants/mine`, `GET /api/v1/tenants/current`
- Core DMS modules:
  - Deals: `/api/v1/deals*`
  - Inventory: `/api/v1/inventory*`
  - Service RO: `/api/v1/service*`
  - Accounting: `/api/v1/acct*`
  - Funding: `/api/v1/funding*`

Backend module map is in `docs/API_INDEX.md`.

## Auth + Tenancy Flow
1. Login with email/password.
2. Store `access_token`.
3. Fetch tenant list from `/api/v1/tenants/mine`.
4. User picks active tenant.
5. Send both headers on tenant-scoped calls:
   - `Authorization: Bearer <access_token>`
   - `X-Tenant-Id: <tenant_id>`

## Contract Invariants
- A.1 Error envelope (all non-2xx responses):
```json
{
  "code": "string",
  "message": "string",
  "details": {},
  "request_id": "string-or-null"
}
```
- Pagination envelope:
```json
{
  "items": [],
  "meta": { "page": 1, "size": 25, "total": 0 }
}
```
- GET-by-id behavior: unknown docs return `404` (no placeholder docs).

## Permissions Summary
- Role normalization is uppercase (`ADMIN`, `USER`, `MEMBER`).
- `ADMIN`: all permissions.
- `USER`/`MEMBER`: baseline read+write app permissions (deals, inventory, service_ro, funding, accounting reads, etc).
- Permission guards are enforced server-side on routes.

## Copy/Paste Frontend Examples
```ts
const base = "http://127.0.0.1:8010/api/v1";

// 1) login
const loginRes = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you@example.com", password: "Password123!" }),
});
const login = await loginRes.json();
const token = login.access_token;

// 2) choose tenant
const mineRes = await fetch(`${base}/tenants/mine?page=1&size=25`, {
  headers: { Authorization: `Bearer ${token}` },
});
const mine = await mineRes.json();
const tenantId = mine.items[0].id;

// 3) tenant-scoped call
const dealsRes = await fetch(`${base}/deals/queue/by-state?page=1&size=25`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "X-Tenant-Id": tenantId,
  },
});
const deals = await dealsRes.json();
```

### Error Handling Snippet
```ts
type ErrorResponse = {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string | null;
};

async function parseOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok) {
    const err = json as ErrorResponse;
    throw new Error(`${err.code}: ${err.message} (request_id=${err.request_id ?? "n/a"})`);
  }
  return json;
}
```

## Workflow Examples
- Deals:
  - `POST /api/v1/deals`
  - `POST /api/v1/deals/{deal_id}/transition`
  - `GET /api/v1/deals/queue/by-state`
- Inventory:
  - `POST /api/v1/inventory/units`
  - `POST /api/v1/inventory/units/{unit_id}/recon-items`
  - `POST /api/v1/inventory/units/{unit_id}/transition`
- Service RO:
  - `POST /api/v1/service/ros`
  - `POST /api/v1/service/ros/{ro_id}/events`
  - `GET /api/v1/service/queue`
- Accounting posting/batches:
  - `POST /api/v1/acct/batches`
  - `POST /api/v1/acct/batches/{batch_id}/validate`
  - `POST /api/v1/acct/batches/{batch_id}/post`
  - `POST /api/v1/acct/journals`

## OpenAPI / TS Client (Frozen Workflow)
- Canonical OpenAPI snapshot file: `frontend/src/api/openapi.json`
- Generated TS types file: `frontend/src/api/types.ts`
- Generate/update both from repo root:
  1. `python backend/tools/export_openapi.py --out frontend/src/api/openapi.json`
  2. `cd frontend && npm run api:types`
- One-command refresh from `frontend/`:
  - `npm run api:generate`
