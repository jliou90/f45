# Frontend Shell (Phase 7)

`frontend/` is a Vite + React + TypeScript DMS shell with plugin-driven modules, contract checks, outbox/offline writes, multi-window sync, tenant branding, server feature flags, print preview, and realtime readiness.

Backend default:
- Origin: `http://127.0.0.1:8010`
- API base: `http://127.0.0.1:8010/api/v1`

## Environment
Copy `.env.local.example` to `.env.local` when overriding defaults:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8010/api/v1
# Optional desktop wrapper detection
VITE_DESKTOP_WRAPPER=0
```

## Run
```bash
npm install
npm run dev
```

## Quality Gates
```bash
npm run gen:api
npm run typecheck
npm run lint
npm run format
npm run test
npm run build
```

## Plugin Architecture Guide
Plugins are declared via `ModulePlugin` in `src/plugins/types.ts` and loaded centrally through `src/plugins/registry.ts`.

Create a new module plugin:
1. Add `<module>/plugin.tsx` exporting a `ModulePlugin`.
2. Define metadata:
- `id`, `name`, `version`, `description`, `keywords`
- `routeBase`, `nav`, `routePolicy`
- optional `featureFlag`, `requiredRoutes`, `realtime`, `print`, `launcherTiles`, `commands`
3. Return route nodes from `routes()` (typically wrapped in `ProtectedRoute`).
4. Register the plugin in `src/plugins/core/index.ts`.

Core shell consumers now read registry models:
- App routes: `getRoutes()`
- Sidebar nav: `getNavModel()`
- Launcher tiles: `getLauncherTiles()`
- Command palette extension: `getPaletteCommands()`

Dev plugin loading:
- `src/plugins/dev-loader.ts` loads `src/plugins/dev/*.plugin.tsx`
- optional JSON include-list config can be provided under `src/plugins/dev/*.json`

## OpenAPI Contract Lock (`gen:api`)
Generate typed contract artifacts:

```bash
npm run gen:api
```

Deterministic mode:
- `gen:api` reads `src/api/openapi.json` (no live backend required).
- `gen:api:live` fetches from backend `/openapi.json`.

Generated files:
- `src/gen/openapi-types.ts`
- `src/gen/openapi-endpoints.ts`

Contract checks:
- Base required routes: `auth/login`, `auth/me`, `auth/refresh`, `tenants/mine`, `tenants/current`, `ops/health`, `ops/version`
- Plugin-required routes from `plugin.requiredRoutes`
- Drift checks compare runtime `/openapi.json` to generated endpoint inventory
- Dev page: `/dev/contracts`
- DEV banner appears if required routes are missing

## Outbox + Offline Workflow
Outbox implementation: `src/lib/outbox.ts`
- IndexedDB queue with idempotency metadata
- API network-failed writes enqueue automatically
- APIs: `enqueue`, `list`, `retry`, `retryAll`, `del`, `clear`, `autoReplay`
- Replay gates: backend connected + authenticated + tenant selected

UI/ops:
- `/ops/outbox` to inspect/retry/delete queue items
- Outbox payload preview is redacted
- Changes broadcast with `OUTBOX_UPDATED`

## Multi-window Sync
`src/lib/window-sync.ts`
- Channel: `BroadcastChannel("kutm-shell")`
- Fallback: localStorage event relay

Events:
- `LOGOUT`
- `TENANT_CHANGED`
- `THEME_CHANGED`
- `FEATURE_FLAGS_UPDATED`
- `OUTBOX_UPDATED`
- `BRANDING_UPDATED`

Behavior:
- Logout in one tab propagates to others
- Tenant/branding/theme/flag changes propagate across tabs
- Outbox UI updates without reload

## Branding + Feature Flags
Branding: `src/lib/branding.ts`
- Sources: tenant metadata, feature-flag payload branding, defaults
- Fields: `brandName`, `primaryColor`, `secondaryColor`, `logoUrl`
- Applied via CSS vars:
  - `--brand-primary`
  - `--brand-secondary`

Feature flags: `src/lib/feature-flags.ts`
- Fetch order:
1. `/api/v1/platform/feature-flags`
2. `/api/v1/ops/feature-flags`
3. Dev fallback
- Tenant-scoped in-memory cache (no localStorage persistence)
- Plugin gating via `plugin.featureFlag`
- `scaffoldEnabled` defaults to `false` to keep scaffold-only modules out of production navigation
- Flag updates broadcast via `FEATURE_FLAGS_UPDATED`

## Print Preview
Print system: `src/lib/print.ts`
- `registerPrintTemplates`
- `renderPrintable`
- `openPrintPreview`

Route:
- `/print/:templateId`
- Page: `src/pages/PrintPreviewPage.tsx`

Implemented templates (plugin-provided):
- `quote`
- `repair-order`

Print output includes tenant branding and `request_id` footer.

## Realtime
Realtime transport: `src/lib/realtime.ts`
- Feature-flag gated by `realtimeEnabled`
- Tries WebSocket (`/api/v1/events/ws`) first, then SSE (`/api/v1/events/stream`)
- Auto-reconnect with exponential backoff
- Stops on unauthorized (`401`)
- If endpoint absent, disables once and logs once

Topbar status:
- `Live`
- `Offline`
- `Disabled`

## Support Bundle Export
Ops and command palette can export support bundles with:
- app/mode/baseUrl/version/current route
- user + tenant role
- feature flags (current + snapshot)
- branding (current + snapshot)
- contract check summary
- last 200 redacted request logs
- outbox summary metadata

## Key Routes
- `/login`
- `/`
- `/ops`
- `/ops/outbox`
- `/tenants`
- `/dms`
- `/dms/accounting/*`
- `/dms/service/*`
- `/dms/sales/*`
- `/dms/comms`
- `/dms/workbench`, `/dms/workbench/:itemId`, `/dms/workbench/:itemId/edit`
- `/print/:templateId`
- `/dev/contracts` (dev)
