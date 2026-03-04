# Frontend API Client Scaffold

`api.ts` provides a typed request wrapper for KUTM frontend apps.

## Guarantees

- Base URL is centralized.
- `Authorization: Bearer <token>` is injected automatically when available.
- `X-Tenant-Id` is injected automatically for tenant-scoped calls.
- `Idempotency-Key` is auto-generated for write requests (`POST|PUT|PATCH|DELETE`).
- Error envelope is normalized into `AppError`.

## Usage

```ts
import { ApiClient } from "./api";

const api = new ApiClient({
  baseUrl: "http://localhost:8000/api/v1",
  getAccessToken: () => localStorage.getItem("access_token"),
  getTenantId: () => localStorage.getItem("tenant_id"),
});

const me = await api.get<{ id: string; email: string }>("/auth/me", undefined, false);
```
