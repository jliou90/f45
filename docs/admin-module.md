# Admin Module

KUTM Admin (`/admin`) is now a tenant-scoped control plane for identity lifecycle, RBAC, feature flags, tenant branding/theme, and admin auditability.

## Permission Catalog

- `admin.users.read`
- `admin.users.write`
- `admin.roles.read`
- `admin.roles.write`
- `admin.audit.read`
- `ops.console.read`
- `tenant.settings.write`
- `featureflags.write`
- `theme.write`

## Backend APIs

All admin endpoints are authenticated, tenant-scoped (`X-Tenant-Id`), and permission-guarded.

### Users / Lifecycle

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/{id}`
- `PUT /api/v1/admin/users/{id}`
- `PUT /api/v1/admin/users/{id}/role`
- `DELETE /api/v1/admin/users/{id}` (disable)
- `POST /api/v1/admin/users/bulk` (`disable`, `set_role`)
- `POST /api/v1/admin/invites`
- `GET /api/v1/admin/invites`
- `DELETE /api/v1/admin/invites/{id}`
- `POST /api/v1/auth/accept-invite` (public-ish + rate limited)
- `POST /api/v1/admin/users/{id}/password-reset`
- `POST /api/v1/auth/reset-password` (public-ish + rate limited)
- `GET /api/v1/admin/users/{id}/sessions`
- `POST /api/v1/admin/users/{id}/sessions/revoke`
- `POST /api/v1/admin/sessions/revoke?session_id=...`

### Roles / RBAC

- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/roles`
- `POST /api/v1/admin/roles`
- `GET /api/v1/admin/roles/{id}`
- `PUT /api/v1/admin/roles/{id}`
- `DELETE /api/v1/admin/roles/{id}?force={bool}`

### Feature Flags

- `GET /api/v1/admin/feature-flags/catalog`
- `GET /api/v1/admin/feature-flags/effective`
- `GET /api/v1/admin/feature-flags/overrides`
- `PUT /api/v1/admin/feature-flags/overrides/{flag_key}`
- `DELETE /api/v1/admin/feature-flags/overrides/{flag_key}?scope=...`

Resolution order: `user override -> role override -> tenant override -> default`.

### Tenant Profile / Theme

- `GET /api/v1/admin/tenant/profile`
- `PUT /api/v1/admin/tenant/profile`
- `PUT /api/v1/admin/tenant/logo-url`
- `GET /api/v1/admin/tenant/theme`
- `PUT /api/v1/admin/tenant/theme`

### Audit

- `GET /api/v1/admin/audit`
- `GET /api/v1/admin/audit/export?fmt=json|csv`

Audit records include `request_id`, actor, action, target, diff, `actor_ip`, and `user_agent`.

## Safety Rails

- Last-admin lockout protection on:
  - user disable
  - role reassignment
  - bulk disable
  - role permission updates
  - role deletion in-use paths
- Self-escalation prevention when actor lacks `admin.roles.write`.
- Read-only mode via feature flag `admin.readOnly`:
  - backend rejects admin writes
  - frontend disables write actions.
- Invite/reset tokens are hashed at rest and redacted in audit metadata.

## Frontend Routes

- `/admin/users` (invite-first flow, bulk actions, sessions, reset password)
- `/admin/invites`
- `/admin/roles`
- `/admin/audit` (detail + export)
- `/admin/feature-flags` (tenant/role overrides + effective preview)
- `/admin/settings` (tenant profile)
- `/admin/theme` (branding/theme)
- `/admin/ops` (ops console integration)

## Migration / Seed

1. Run migrations from `backend`:
   - `alembic upgrade head`
2. Ensure permission catalog and admin role are seeded (existing startup/seed path).
3. Optional dev bootstrap:
   - `python seed_admin.py`

## Manual Validation

1. Start backend and frontend.
2. Log in as ADMIN/OPS and select tenant.
3. Open `Admin -> Users`:
   - invite user
   - edit role/name/active state
   - reset password
   - revoke sessions
   - run bulk disable or bulk role change
4. Open `Admin -> Invites` and revoke an active invite.
5. Open `Admin -> Feature Flags`:
   - set tenant override
   - set role override
   - confirm effective preview updates
6. Open `Admin -> Theme` and `Admin -> Settings`:
   - update branding/profile and verify persistence
7. Open `Admin -> Audit`:
   - filter events
   - inspect diff and request_id
   - export JSON and CSV.
