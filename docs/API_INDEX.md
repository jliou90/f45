# KUTM - API Index (Live Routes)

Source of truth is the running router graph in `backend/app/router/api.py` with prefix `/api/v1`.

## Global Health
- `GET /healthz` -> `backend/app/main.py`
- `GET /readyz` -> `backend/app/main.py`

## Ops (Main)
- `GET /api/v1/ops/health` -> `backend/app/modules/ops/api.py`
- `GET /api/v1/ops/version` -> `backend/app/modules/ops/api.py`

## Health Module
- `GET /api/v1/health` -> `backend/app/modules/health/api.py`
- `GET /api/v1/version` -> `backend/app/modules/health/api.py`

## Identity
- `POST /api/v1/auth/login` -> `backend/app/modules/identity/api.py`
- `POST /api/v1/auth/refresh` -> `backend/app/modules/identity/api.py`
- `GET /api/v1/auth/me` -> `backend/app/modules/identity/api.py`

## Tenancy
- `POST /api/v1/tenants` -> `backend/app/modules/tenancy/api.py`
- `GET /api/v1/tenants/mine` -> `backend/app/modules/tenancy/api.py`
- `GET /api/v1/tenants/current` -> `backend/app/modules/tenancy/api.py`

## RBAC
- `GET /api/v1/rbac/roles` -> `backend/app/modules/rbac/api.py`
- `GET /api/v1/rbac/permissions` -> `backend/app/modules/rbac/api.py`

## Audit
- `GET /api/v1/audit/events` -> `backend/app/modules/audit/api.py`

## DMS
- `POST /api/v1/dms/customers` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/customers` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/customers/{customer_id}` -> `backend/app/modules/dms/api.py`
- `PUT|PATCH|DELETE /api/v1/dms/customers/{customer_id}` -> `backend/app/modules/dms/api.py`
- `POST /api/v1/dms/vehicles` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/vehicles` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/vehicles/{vehicle_id}` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/vehicles/by-vin/{vin}` -> `backend/app/modules/dms/api.py`
- `PUT|PATCH|DELETE /api/v1/dms/vehicles/{vehicle_id}` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/customers/{customer_id}/vehicles` -> `backend/app/modules/dms/api.py`
- `POST /api/v1/dms/appointments` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/appointments` -> `backend/app/modules/dms/api.py`
- `GET /api/v1/dms/appointments/{appointment_id}` -> `backend/app/modules/dms/api.py`
- `PUT|PATCH|DELETE /api/v1/dms/appointments/{appointment_id}` -> `backend/app/modules/dms/api.py`
- `POST /api/v1/dms/comms/{conversation_id}/approval` -> `backend/app/modules/dms/api.py`

## Service RO
- `POST /api/v1/service/ros` -> `backend/app/modules/service_ro/api.py`
- `POST /api/v1/service/ros/{ro_id}/events` -> `backend/app/modules/service_ro/api.py`
- `GET /api/v1/service/ros/{ro_id}` -> `backend/app/modules/service_ro/api.py`
- `GET /api/v1/service/queue` -> `backend/app/modules/service_ro/api.py`

## Funding
- `POST /api/v1/funding/deals` -> `backend/app/modules/funding/api.py`
- `POST /api/v1/funding/deals/{deal_id}/events` -> `backend/app/modules/funding/api.py`
- `GET /api/v1/funding/deals/{deal_id}` -> `backend/app/modules/funding/api.py`
- `GET /api/v1/funding/queue` -> `backend/app/modules/funding/api.py`

## Eventstore + Documents
- `POST /api/v1/events` -> `backend/app/modules/eventstore/api.py`
- `GET /api/v1/events` -> `backend/app/modules/eventstore/api.py`
- `POST /api/v1/docs/attachments/upload` -> `backend/app/modules/documents/api.py`
- `GET /api/v1/docs/attachments/{attachment_id}` -> `backend/app/modules/documents/api.py`
- `GET /api/v1/docs/attachments/{attachment_id}/download` -> `backend/app/modules/documents/api.py`
- `POST /api/v1/docs/attachments/{attachment_id}/links` -> `backend/app/modules/documents/api.py`
- `GET /api/v1/docs/attachments/{attachment_id}/links` -> `backend/app/modules/documents/api.py`
- `DELETE /api/v1/docs/attachments/{attachment_id}/links/{link_id}` -> `backend/app/modules/documents/api.py`
- `POST /api/v1/docs/{doc_type}` -> `backend/app/modules/documents/api.py`
- `PUT /api/v1/docs/{doc_type}/{doc_id}` -> `backend/app/modules/documents/api.py`
- `GET /api/v1/docs/{doc_type}` -> `backend/app/modules/documents/api.py`
- `GET /api/v1/docs/{doc_type}/{doc_id}` -> `backend/app/modules/documents/api.py`
- `POST /api/v1/docs/{doc_type}/{doc_id}/rebuild` -> `backend/app/modules/documents/api.py`

## Jobs
- `POST /api/v1/jobs/{job_type}` -> `backend/app/modules/jobs/api.py`
- `GET /api/v1/jobs/{job_id}` -> `backend/app/modules/jobs/api.py`

## Integrations + IO + Selfheal + Platform
- `GET|POST|PATCH /api/v1/integrations/webhooks*` -> `backend/app/modules/integrations/api.py`
- `POST /api/v1/integrations/outbox/drain` -> `backend/app/modules/integrations/api.py`
- `GET /api/v1/io/export/{doc_type}` -> `backend/app/modules/io/api.py`
- `POST /api/v1/io/import/{doc_type}` -> `backend/app/modules/io/api.py`
- `GET /api/v1/selfheal/status` -> `backend/app/modules/selfheal/api.py`
- `POST /api/v1/selfheal/rebuild/{doc_type}/{doc_id}` -> `backend/app/modules/selfheal/api.py`
- `POST /api/v1/selfheal/rebuild_type/{doc_type}` -> `backend/app/modules/selfheal/api.py`
- `POST /api/v1/ops/bootstrap` -> `backend/app/modules/ops/api.py`
- `GET /api/v1/platform/health` -> `backend/app/modules/platform/routes.py`
- `GET /api/v1/platform/version` -> `backend/app/modules/platform/routes.py`
