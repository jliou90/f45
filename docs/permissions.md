# Permissions Matrix

This project uses explicit role-to-permission RBAC for tenant-scoped APIs.

## Roles

- `ADMIN`
- `MEMBER`
- `USER`

Role names are normalized to uppercase in request context and membership writes.

## Permissions

- `accounting.read`
- `accounting.write`
- `funding.read`
- `funding.write`
- `service_ro.read`
- `service_ro.write`
- `documents.read`
- `documents.write`
- `dms.read`
- `dms.write`
- `integrations.read`
- `integrations.write`
- `audit.read`
- `eventstore.read`
- `eventstore.write`
- `io.read`
- `io.write`
- `selfheal.read`
- `selfheal.write`
- `rbac.read`
- `platform.read`

## Role -> Permissions

- `ADMIN`: all permissions.
- `MEMBER`: `accounting.read`, `funding.read`, `funding.write`, `service_ro.read`, `service_ro.write`, `documents.read`, `documents.write`, `dms.read`, `dms.write`, `audit.read`, `eventstore.read`, `eventstore.write`, `rbac.read`, `platform.read`.
- `USER`: same as `MEMBER`.

## Module Coverage

- `accounting`: explicit `accounting.read` and `accounting.write`
- `funding`: explicit `funding.read` and `funding.write`
- `service_ro`: explicit `service_ro.read` and `service_ro.write`
- `documents`: explicit `documents.read` and `documents.write`
- `dms`: explicit `dms.read` and `dms.write`
- `integrations`: explicit `integrations.read` and `integrations.write`
- `audit`: explicit `audit.read`
- `eventstore`: explicit `eventstore.read` and `eventstore.write`
- `io`: explicit `io.read` and `io.write`
- `selfheal`: explicit `selfheal.read` and `selfheal.write`
- `rbac`: explicit `rbac.read`
- `platform`: explicit `platform.read`

## Guard Dependencies

- `require_permission(permission)`
- `require_any_permission(*permissions)`

All authorization failures return canonical `ErrorResponse` via `AppError` (`code="permission_denied"`, `status_code=403`).
