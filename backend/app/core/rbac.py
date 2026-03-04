from __future__ import annotations

from collections.abc import Callable
from enum import Enum

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.tenancy.deps import get_current_tenant, require_tenant_role
from app.db.session import get_db
from app.modules.rbac.models import RolePermission
from app.modules.tenancy.models import Membership, Tenant
from fastapi import Depends, Request
from sqlalchemy.orm import Session


class Permission(str, Enum):
    ACCOUNTING_READ = "accounting.read"
    ACCOUNTING_WRITE = "accounting.write"
    FUNDING_READ = "funding.read"
    FUNDING_WRITE = "funding.write"
    SERVICE_RO_READ = "service_ro.read"
    SERVICE_RO_WRITE = "service_ro.write"
    DEALS_READ = "deals.read"
    DEALS_WRITE = "deals.write"
    INVENTORY_READ = "inventory.read"
    INVENTORY_WRITE = "inventory.write"
    DOCUMENTS_READ = "documents.read"
    DOCUMENTS_WRITE = "documents.write"
    DMS_READ = "dms.read"
    DMS_WRITE = "dms.write"
    INTEGRATIONS_READ = "integrations.read"
    INTEGRATIONS_WRITE = "integrations.write"
    AUDIT_READ = "audit.read"
    EVENTSTORE_READ = "eventstore.read"
    EVENTSTORE_WRITE = "eventstore.write"
    IO_READ = "io.read"
    IO_WRITE = "io.write"
    SELFHEAL_READ = "selfheal.read"
    SELFHEAL_WRITE = "selfheal.write"
    RBAC_READ = "rbac.read"
    PLATFORM_READ = "platform.read"
    ADMIN_USERS_READ = "admin.users.read"
    ADMIN_USERS_WRITE = "admin.users.write"
    ADMIN_ROLES_READ = "admin.roles.read"
    ADMIN_ROLES_WRITE = "admin.roles.write"
    ADMIN_AUDIT_READ = "admin.audit.read"
    OPS_CONSOLE_READ = "ops.console.read"
    TENANT_SETTINGS_WRITE = "tenant.settings.write"
    FEATUREFLAGS_WRITE = "featureflags.write"
    THEME_WRITE = "theme.write"


ALL_PERMISSIONS = frozenset(Permission)

_BASE_READ = frozenset(
    {
        Permission.ACCOUNTING_READ,
        Permission.FUNDING_READ,
        Permission.SERVICE_RO_READ,
        Permission.DEALS_READ,
        Permission.INVENTORY_READ,
        Permission.DOCUMENTS_READ,
        Permission.DMS_READ,
        Permission.AUDIT_READ,
        Permission.EVENTSTORE_READ,
        Permission.RBAC_READ,
        Permission.PLATFORM_READ,
    }
)

_BASE_WRITE = frozenset(
    {
        Permission.FUNDING_WRITE,
        Permission.SERVICE_RO_WRITE,
        Permission.DEALS_WRITE,
        Permission.INVENTORY_WRITE,
        Permission.DOCUMENTS_WRITE,
        Permission.DMS_WRITE,
        Permission.EVENTSTORE_WRITE,
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    "ADMIN": ALL_PERMISSIONS,
    "MEMBER": _BASE_READ | _BASE_WRITE,
    "USER": _BASE_READ | _BASE_WRITE,
    "OPS": _BASE_READ | {Permission.OPS_CONSOLE_READ},
}


def normalize_role(role: str | None) -> str:
    value = (role or "").strip().upper()
    if not value:
        return "USER"
    return value


def permissions_for_role(role: str | None) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(normalize_role(role), ROLE_PERMISSIONS["USER"])


def _normalize_permission_key(value: Permission | str) -> str:
    if isinstance(value, Permission):
        return value.value
    normalized = value.strip().lower()
    if not normalized:
        raise AppError(code="permission_invalid", message="Invalid permission key", status_code=400)
    return normalized


def _membership_permissions(
    *,
    db: Session,
    tenant_id: str,
    user_id: str,
    fallback_role: str | None,
) -> set[str]:
    membership = db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})
    if membership is None:
        return set()

    granted: set[str] = set()
    if membership.role_id:
        rows = (
            db.query(RolePermission.permission_key)
            .filter(RolePermission.role_id == membership.role_id)
            .all()
        )
        granted.update(row[0] for row in rows)

    if granted:
        return granted

    role_name = normalize_role(getattr(membership, "role", None) or fallback_role)
    return {perm.value for perm in permissions_for_role(role_name)}


def _resolve_granted_permissions(
    *,
    request: Request,
    db: Session,
    tenant_id: str,
    user_id: str,
    role: str,
) -> set[str]:
    preset = getattr(request.state, "tenant_permissions", None)
    if isinstance(preset, list | tuple | set) and preset:
        return {str(p) for p in preset}
    try:
        return _membership_permissions(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            fallback_role=role,
        )
    except Exception:
        return {perm.value for perm in permissions_for_role(role)}


def require_permission(permission: Permission | str) -> Callable[[Request], str]:
    required = _normalize_permission_key(permission)

    def _inner(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user),
        _tenant: Tenant = Depends(get_current_tenant),
    ) -> str:
        tenant_id = str(getattr(request.state, "tenant_id", "") or "")
        role = normalize_role(getattr(request.state, "tenant_role", None))
        granted = _resolve_granted_permissions(
            request=request,
            db=db,
            tenant_id=tenant_id,
            user_id=user.id,
            role=role,
        )

        request.state.tenant_role = role
        request.state.tenant_permissions = sorted(granted)

        if required not in granted:
            raise AppError(
                code="permission_denied",
                message="Insufficient permissions",
                status_code=403,
                details={
                    "required_permissions": [required],
                    "role": role,
                },
            )
        return required

    return _inner


def require_any_permission(*permissions: Permission | str) -> Callable[[Request], list[str]]:
    required = [_normalize_permission_key(p) for p in permissions]
    required_set = set(required)

    def _inner(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user),
        _tenant: Tenant = Depends(get_current_tenant),
    ) -> list[str]:
        tenant_id = str(getattr(request.state, "tenant_id", "") or "")
        role = normalize_role(getattr(request.state, "tenant_role", None))
        granted = _resolve_granted_permissions(
            request=request,
            db=db,
            tenant_id=tenant_id,
            user_id=user.id,
            role=role,
        )

        request.state.tenant_role = role
        request.state.tenant_permissions = sorted(granted)

        if granted.isdisjoint(required_set):
            raise AppError(
                code="permission_denied",
                message="Insufficient permissions",
                status_code=403,
                details={
                    "required_any_permissions": sorted(required_set),
                    "role": role,
                },
            )
        return sorted(required_set)

    return _inner


__all__ = [
    "Permission",
    "ROLE_PERMISSIONS",
    "normalize_role",
    "permissions_for_role",
    "require_permission",
    "require_any_permission",
    "require_tenant_role",
]
