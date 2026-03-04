from __future__ import annotations

from uuid import uuid4

from app.core.rbac import ALL_PERMISSIONS, ROLE_PERMISSIONS, normalize_role, permissions_for_role
from app.modules.rbac.models import PermissionGrant, Role, RolePermission
from sqlalchemy.orm import Session

PERMISSION_CATALOG: tuple[tuple[str, str], ...] = (
    ("admin.users.read", "View tenant users"),
    ("admin.users.write", "Create and update tenant users"),
    ("admin.roles.read", "View tenant roles and permission mappings"),
    ("admin.roles.write", "Create and update tenant roles and permissions"),
    ("admin.audit.read", "View tenant admin audit trail"),
    ("ops.console.read", "Access operations console"),
    ("tenant.settings.write", "Manage tenant settings"),
    ("featureflags.write", "Manage tenant feature flags"),
    ("theme.write", "Manage tenant branding theme"),
    ("dms.scheduler.read", "View technician availability and scheduler context"),
    ("comms.customer.read", "View outbound customer communications"),
    ("comms.customer.write", "Send and log outbound customer communications"),
    ("comms.funding.write", "Send lender stip communications and update funding status"),
    ("inventory.supplies.read", "View consumable inventory supply levels"),
    ("inventory.supplies.write", "Create and update consumable inventory supplies"),
    ("inventory.procurement.read", "View inventory procurement order batches"),
    ("inventory.procurement.write", "Create and update inventory procurement order batches"),
)

DEFAULT_ADMIN_PERMISSIONS: tuple[str, ...] = (
    "admin.users.read",
    "admin.users.write",
    "admin.roles.read",
    "admin.roles.write",
    "admin.audit.read",
    "ops.console.read",
    "dms.scheduler.read",
    "comms.customer.read",
    "comms.customer.write",
    "comms.funding.write",
    "inventory.supplies.read",
    "inventory.supplies.write",
    "inventory.procurement.read",
    "inventory.procurement.write",
)


def list_roles(*, q: str | None = None) -> list[str]:
    roles = sorted(ROLE_PERMISSIONS.keys())
    if q and q.strip():
        needle = q.strip().lower()
        roles = [role for role in roles if needle in role.lower()]
    return roles


def list_permissions(*, q: str | None = None, role: str | None = None) -> list[str]:
    if role and role.strip():
        permissions = sorted(p.value for p in permissions_for_role(role))
    else:
        permissions = sorted(p.value for p in ALL_PERMISSIONS)

    if q and q.strip():
        needle = q.strip().lower()
        permissions = [perm for perm in permissions if needle in perm.lower()]
    return permissions


def normalize_role_filter(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    return normalize_role(value)


def seed_permission_catalog(db: Session) -> None:
    existing = {row[0] for row in db.query(PermissionGrant.key).all()}
    for key, description in PERMISSION_CATALOG:
        if key in existing:
            db.query(PermissionGrant).filter(PermissionGrant.key == key).update(
                {"description": description},
                synchronize_session=False,
            )
            continue
        db.add(PermissionGrant(key=key, description=description))
    db.flush()


def ensure_default_admin_role(db: Session, *, tenant_id: str) -> Role:
    seed_permission_catalog(db)
    role = db.query(Role).filter(Role.tenant_id == tenant_id, Role.name == "ADMIN").one_or_none()
    if role is None:
        role = Role(
            id=str(uuid4()),
            tenant_id=tenant_id,
            name="ADMIN",
            description="Default admin role",
        )
        db.add(role)
        db.flush()

    existing_permissions = {
        row[0]
        for row in (
            db.query(RolePermission.permission_key)
            .filter(RolePermission.role_id == role.id)
            .all()
        )
    }
    for key in DEFAULT_ADMIN_PERMISSIONS:
        if key not in existing_permissions:
            db.add(RolePermission(role_id=role.id, permission_key=key))
    db.flush()
    return role
