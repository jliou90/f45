# Ops Console

## Route and Access
- Frontend route: `/admin/ops`
- Backend endpoints:
  - `GET /api/v1/ops/status`
  - `GET /api/v1/ops/logs/tail?limit=50`
- Access control: tenant role `ADMIN` or `OPS` only.
- Feature flag: `diagnosticsEnabled` (default `true` in dev, `false` in prod unless enabled).

## What It Captures
- Frontend errors: `window.onerror`, `unhandledrejection`, React error boundary events.
- Console capture: `console.log/warn/error` with opt-in and level filtering.
- Network capture: fetch events with method/path/status/duration/request ids.
- Performance capture: navigation/resource/longtask/paint plus custom marks.
- Persistence: snapshot ring buffers in `sessionStorage`.

## Export Bundle
`Export diagnostics` generates a redacted JSON payload including:
- app version
- active tenant id
- recent network events (redacted)
- recent error events (PII redacted)
- performance snapshot
- backend `ops/status` payload

## Multi-tab Sync
BroadcastChannel name: `kutm`
- capture enabled toggle
- log level changes
- export trigger
- tenant switch/logout sync (existing shell events)

## Smoke Script
Run from repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops-smoke.ps1 -BaseUrl http://127.0.0.1:8010
```
