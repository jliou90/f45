# Maturity Rollout Checklist

Last updated: March 4, 2026

This checklist covers rollout of the backend maturity patch that adds:
- MFA login enforcement (`/auth/mfa/*`)
- Outbound comms (`/comms/*`) for customer email and funding stip delivery
- Inventory supplies + procurement order batches (`/inventory/supplies`, `/inventory/order-batches`)
- Scheduler availability (`/dms/availability/technicians`)
- Export extensions (`/io/export/{doc_type}?fmt=xlsx|pdf`)

Primary migration revision:
- `a9c4e5f6d7a8`

## 1. Pre-Deploy

1. Confirm clean artifact build and tests:
   - `backend`: `python -m pytest -q`
   - `frontend`: `npm test && npm run typecheck`
2. Confirm final migration graph:
   - `cd backend`
   - `python -m alembic heads`
   - Expected single head: `a9c4e5f6d7a8`
3. Capture DB backup:
   - From repo root: `powershell -File .\scripts\backup-db.ps1`

## 2. Environment Variables

Add/verify in `backend/.env`:
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM` (example `noreply@dealer.example`)
- `SMTP_USE_TLS` (`1` recommended)

If SMTP vars are empty, comms endpoints run in demo-local delivery mode.

## 3. Migration

1. Apply schema/data migration:
   - `cd backend`
   - `python -m alembic upgrade head`
2. Verify current revision:
   - `python -m alembic current`
   - Expected: includes `a9c4e5f6d7a8`

## 4. Permission Seed Verification

The patch includes new permission keys:
- `dms.scheduler.read`
- `comms.customer.read`
- `comms.customer.write`
- `comms.funding.write`
- `inventory.supplies.read`
- `inventory.supplies.write`
- `inventory.procurement.read`
- `inventory.procurement.write`

Verification SQL:

```sql
SELECT key
FROM permissions
WHERE key IN (
  'dms.scheduler.read',
  'comms.customer.read',
  'comms.customer.write',
  'comms.funding.write',
  'inventory.supplies.read',
  'inventory.supplies.write',
  'inventory.procurement.read',
  'inventory.procurement.write'
)
ORDER BY key;
```

## 5. API Smoke (Post-Deploy)

Run these with an admin token + `X-Tenant-Id`:

1. MFA
   - `POST /api/v1/auth/mfa/enroll/start`
   - `POST /api/v1/auth/mfa/enroll/verify`
2. Comms
   - `POST /api/v1/comms/customers/{customer_id}/email`
   - `GET /api/v1/comms/customers/{customer_id}`
   - `POST /api/v1/comms/funding/{deal_id}/stip`
3. Scheduler
   - `GET /api/v1/dms/availability/technicians?day=YYYY-MM-DD&page=1&size=50`
4. Procurement
   - `POST /api/v1/inventory/supplies`
   - `POST /api/v1/inventory/order-batches`
   - `PUT /api/v1/inventory/order-batches/{batch_id}/lines`
5. Export
   - `GET /api/v1/io/export/{doc_type}?fmt=xlsx`
   - `GET /api/v1/io/export/{doc_type}?fmt=pdf&orientation=landscape&scale=140`

## 6. Frontend Contract Sync

1. Export OpenAPI:
   - `cd backend`
   - `python .\tools\export_openapi.py --out ..\frontend\src\api\openapi.json`
2. Regenerate TS API types:
   - `cd ..\frontend`
   - `npm run api:types`
   - `npm run typecheck`

## 7. Rollback Plan

1. Stop application writes.
2. Restore latest DB backup (`scripts/restore-db.ps1`) to pre-migration snapshot.
3. Redeploy previous backend image/artifact.
4. Validate:
   - `/readyz` healthy
   - login + existing core workflows operational

## 8. Release Sign-off

Checklist:
- Migration applied
- Permission keys present
- MFA flow validated
- Comms flow validated (customer + lender stip)
- Procurement flow validated
- Scheduler availability endpoint validated
- XLSX/PDF exports validated
- Backend and frontend test suites green
