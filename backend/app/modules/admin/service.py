from __future__ import annotations

import csv
import hashlib
import io
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.config import AppEnv, settings
from app.core.errors import AppError, conflict, not_found, validation_error
from app.core.request_id import get_request_id
from app.core.security import hash_password
from app.modules.admin.models import (
    FeatureFlag,
    InviteToken,
    PasswordResetToken,
    RoleFeatureOverride,
    TenantFeatureOverride,
    TenantProfile,
    UserFeatureOverride,
)
from app.modules.audit.models import AuditEvent
from app.modules.audit.service import log_audit_event
from app.modules.identity.models import RefreshToken, User
from app.modules.identity.service import (
    disable_user as disable_user_tokens,
)
from app.modules.identity.service import (
    revoke_all_refresh_tokens_for_user,
)
from app.modules.rbac.models import PermissionGrant, Role, RolePermission
from app.modules.tenancy.models import Membership
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

ADMIN_USERS_WRITE = "admin.users.write"
ADMIN_ROLES_WRITE = "admin.roles.write"
FEATUREFLAG_PERMISSION = "featureflags.write"
TENANT_SETTINGS_PERMISSION = "tenant.settings.write"
THEME_PERMISSION = "theme.write"
READ_ONLY_FLAG = "admin.readOnly"

DEFAULT_FEATURE_FLAG_CATALOG: tuple[tuple[str, str, bool | str | int | float | None], ...] = (
    ("diagnostics.enabled", "Ops diagnostics and console", True),
    ("comms.enabled", "Comms module visibility", True),
    ("service.betaScheduler", "Service beta scheduler", False),
    ("admin.readOnly", "Read-only mode for admin control plane", False),
    ("theme.printHeaderEnabled", "Print header with tenant branding", False),
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_dev_mode() -> bool:
    return settings.runtime_env is AppEnv.DEV


def normalize_role_name(name: str) -> str:
    normalized = (name or "").strip().upper()
    if not normalized:
        raise validation_error("Role name is required", code="role_name_required")
    return normalized


def normalize_permission_keys(keys: list[str]) -> list[str]:
    return sorted({(key or "").strip().lower() for key in keys if (key or "").strip()})


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_permission_keys(db: Session, *, tenant_id: str, user_id: str) -> set[str]:
    membership = db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})
    if membership is None:
        return set()
    if membership.role_id:
        rows = db.query(RolePermission.permission_key).filter(RolePermission.role_id == membership.role_id).all()
        if rows:
            return {row[0] for row in rows}
    return {ADMIN_USERS_WRITE, ADMIN_ROLES_WRITE} if (membership.role or "").upper() == "ADMIN" else set()


def _admin_capable_user_ids(db: Session, *, tenant_id: str) -> set[str]:
    ids = {
        row[0]
        for row in (
            db.query(Membership.user_id)
            .join(User, User.id == Membership.user_id)
            .join(RolePermission, RolePermission.role_id == Membership.role_id)
            .filter(
                Membership.tenant_id == tenant_id,
                RolePermission.permission_key == ADMIN_USERS_WRITE,
                User.is_active.is_(True),
                User.is_disabled.is_(False),
            )
            .distinct()
            .all()
        )
    }
    legacy_admin_ids = {
        row[0]
        for row in (
            db.query(Membership.user_id)
            .join(User, User.id == Membership.user_id)
            .filter(
                Membership.tenant_id == tenant_id,
                func.upper(Membership.role) == "ADMIN",
                User.is_active.is_(True),
                User.is_disabled.is_(False),
            )
            .distinct()
            .all()
        )
    }
    return ids | legacy_admin_ids


def _role_permissions(db: Session, *, role_id: str) -> list[str]:
    rows = db.query(RolePermission.permission_key).filter(RolePermission.role_id == role_id).order_by(RolePermission.permission_key.asc()).all()
    return [row[0] for row in rows]


def _assert_permission_keys_exist(db: Session, *, permission_keys: list[str]) -> None:
    if not permission_keys:
        return
    existing = {row[0] for row in db.query(PermissionGrant.key).filter(PermissionGrant.key.in_(permission_keys)).all()}
    missing = sorted(set(permission_keys) - existing)
    if missing:
        raise validation_error("Unknown permissions in request", code="permission_keys_invalid", details={"missing": missing})


def _get_role_for_tenant(db: Session, *, tenant_id: str, role_id: str) -> Role:
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if role is None:
        raise validation_error("Invalid role id for tenant", code="role_not_in_tenant")
    return role


def _role_id_for_user(db: Session, *, tenant_id: str, user_id: str) -> str | None:
    membership = db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})
    return membership.role_id if membership else None


def ensure_feature_flag_catalog(db: Session) -> None:
    existing = {row[0] for row in db.query(FeatureFlag.key).all()}
    for key, description, default_value in DEFAULT_FEATURE_FLAG_CATALOG:
        if key in existing:
            db.query(FeatureFlag).filter(FeatureFlag.key == key).update(
                {"description": description, "default_value": default_value},
                synchronize_session=False,
            )
        else:
            db.add(FeatureFlag(key=key, description=description, default_value=default_value))
    db.flush()


def resolve_effective_flags(
    db: Session,
    *,
    tenant_id: str,
    user_id: str | None = None,
    role_id: str | None = None,
) -> dict[str, bool | str | int | float | dict | list | None]:
    ensure_feature_flag_catalog(db)
    defaults = {row.key: row.default_value for row in db.query(FeatureFlag).all()}
    tenant_overrides = {
        row.flag_key: (row.value if row.enabled else None)
        for row in db.query(TenantFeatureOverride).filter(TenantFeatureOverride.tenant_id == tenant_id).all()
    }
    resolved: dict[str, bool | str | int | float | dict | list | None] = {**defaults, **tenant_overrides}

    role_scope_id = role_id
    if role_scope_id is None and user_id:
        role_scope_id = _role_id_for_user(db, tenant_id=tenant_id, user_id=user_id)

    if role_scope_id:
        role_overrides = {
            row.flag_key: (row.value if row.enabled else None)
            for row in db.query(RoleFeatureOverride).filter(
                RoleFeatureOverride.tenant_id == tenant_id,
                RoleFeatureOverride.role_id == role_scope_id,
            ).all()
        }
        resolved.update(role_overrides)

    if user_id:
        user_overrides = {
            row.flag_key: (row.value if row.enabled else None)
            for row in db.query(UserFeatureOverride).filter(
                UserFeatureOverride.tenant_id == tenant_id,
                UserFeatureOverride.user_id == user_id,
            ).all()
        }
        resolved.update(user_overrides)
    return resolved


def is_admin_read_only(db: Session, *, tenant_id: str, user_id: str | None = None, role_id: str | None = None) -> bool:
    effective = resolve_effective_flags(db, tenant_id=tenant_id, user_id=user_id, role_id=role_id)
    return bool(effective.get(READ_ONLY_FLAG, False))


def enforce_admin_writable(db: Session, *, tenant_id: str, user_id: str | None = None) -> None:
    if is_admin_read_only(db, tenant_id=tenant_id, user_id=user_id):
        raise AppError(
            code="admin_read_only",
            message="Admin control plane is currently read-only.",
            status_code=409,
            details={"flag": READ_ONLY_FLAG},
        )


def list_permissions(db: Session) -> list[PermissionGrant]:
    return list(db.query(PermissionGrant).order_by(PermissionGrant.key.asc()).all())

def list_roles(db: Session, *, tenant_id: str, query: str | None = None) -> list[dict]:
    permissions_subq = db.query(RolePermission.role_id, func.count(RolePermission.permission_key).label("permission_count")).group_by(RolePermission.role_id).subquery()
    memberships_subq = db.query(Membership.role_id, func.count(Membership.user_id).label("memberships_count")).filter(Membership.tenant_id == tenant_id).group_by(Membership.role_id).subquery()
    q = (
        db.query(Role, func.coalesce(permissions_subq.c.permission_count, 0), func.coalesce(memberships_subq.c.memberships_count, 0))
        .outerjoin(permissions_subq, permissions_subq.c.role_id == Role.id)
        .outerjoin(memberships_subq, memberships_subq.c.role_id == Role.id)
        .filter(Role.tenant_id == tenant_id)
    )
    if query and query.strip():
        q = q.filter(func.upper(Role.name).like(f"%{query.strip().upper()}%"))
    q = q.order_by(Role.name.asc())
    return [
        {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "permission_count": int(permission_count or 0),
            "memberships_count": int(memberships_count or 0),
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        }
        for role, permission_count, memberships_count in q.all()
    ]


def get_role(db: Session, *, tenant_id: str, role_id: str) -> dict:
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if role is None:
        raise not_found("Role not found", code="role_not_found")
    memberships_count = int(db.query(func.count(Membership.user_id)).filter(Membership.tenant_id == tenant_id, Membership.role_id == role_id).scalar() or 0)
    return {
        "id": role.id,
        "tenant_id": role.tenant_id,
        "name": role.name,
        "description": role.description,
        "permissions": _role_permissions(db, role_id=role.id),
        "memberships_count": memberships_count,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }


def create_role(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    name: str,
    description: str | None,
    permissions: list[str],
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> Role:
    normalized_name = normalize_role_name(name)
    permission_keys = normalize_permission_keys(permissions)
    _assert_permission_keys_exist(db, permission_keys=permission_keys)
    if db.query(Role.id).filter(Role.tenant_id == tenant_id, Role.name == normalized_name).first():
        raise conflict("Role name already exists", code="role_name_conflict")
    role = Role(id=str(uuid4()), tenant_id=tenant_id, name=normalized_name, description=(description or "").strip() or None)
    db.add(role)
    db.flush()
    for key in permission_keys:
        db.add(RolePermission(role_id=role.id, permission_key=key))
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="role.create",
        entity_type="role",
        entity_id=role.id,
        after={"name": role.name, "description": role.description, "permissions": permission_keys},
    )
    return role


def update_role(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    role_id: str,
    name: str,
    description: str | None,
    permissions: list[str],
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> Role:
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if role is None:
        raise not_found("Role not found", code="role_not_found")
    normalized_name = normalize_role_name(name)
    permission_keys = normalize_permission_keys(permissions)
    _assert_permission_keys_exist(db, permission_keys=permission_keys)
    if db.query(Role.id).filter(Role.tenant_id == tenant_id, Role.name == normalized_name, Role.id != role_id).first():
        raise conflict("Role name already exists", code="role_name_conflict")
    before = {"name": role.name, "description": role.description, "permissions": _role_permissions(db, role_id=role.id)}
    role.name = normalized_name
    role.description = (description or "").strip() or None
    role.updated_at = _utcnow()
    db.add(role)
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete(synchronize_session=False)
    for key in permission_keys:
        db.add(RolePermission(role_id=role.id, permission_key=key))
    db.flush()
    affected_user_ids = {row[0] for row in db.query(Membership.user_id).filter(Membership.tenant_id == tenant_id, Membership.role_id == role.id).all()}
    if ADMIN_USERS_WRITE not in permission_keys and affected_user_ids and not (_admin_capable_user_ids(db, tenant_id=tenant_id) - affected_user_ids):
        raise validation_error("Cannot remove last admin-equivalent from tenant", code="last_admin_protection")
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="role.update",
        entity_type="role",
        entity_id=role.id,
        before=before,
        after={"name": role.name, "description": role.description, "permissions": permission_keys},
    )
    return role


def delete_role(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    role_id: str,
    force: bool = False,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if role is None:
        raise not_found("Role not found", code="role_not_found")
    permission_keys = set(_role_permissions(db, role_id=role.id))
    memberships = db.query(Membership).filter(Membership.tenant_id == tenant_id, Membership.role_id == role.id).all()
    if memberships and not force:
        raise conflict("Role is in use by memberships", code="role_in_use", details={"memberships_count": len(memberships)})
    if memberships and ADMIN_USERS_WRITE in permission_keys:
        impacted_user_ids = {m.user_id for m in memberships}
        if not (_admin_capable_user_ids(db, tenant_id=tenant_id) - impacted_user_ids):
            raise validation_error("Cannot remove last admin-equivalent from tenant", code="last_admin_protection")
    if force:
        for membership in memberships:
            membership.role_id = None
            membership.role = "USER"
            membership.updated_at = _utcnow()
            db.add(membership)
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete(synchronize_session=False)
    db.delete(role)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="role.delete",
        entity_type="role",
        entity_id=role_id,
        before={"name": role.name, "permissions": sorted(permission_keys), "memberships_count": len(memberships)},
    )


def list_users(db: Session, *, tenant_id: str, query: str | None = None) -> list[dict]:
    q = (
        db.query(Membership, User, Role)
        .join(User, User.id == Membership.user_id)
        .outerjoin(Role, and_(Role.id == Membership.role_id, Role.tenant_id == Membership.tenant_id))
        .filter(Membership.tenant_id == tenant_id)
    )
    if query and query.strip():
        needle = f"%{query.strip().lower()}%"
        q = q.filter(or_(func.lower(User.email).like(needle), func.lower(func.coalesce(User.display_name, "")).like(needle)))
    q = q.order_by(User.updated_at.desc(), User.email.asc())
    return [
        {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "is_active": bool(user.is_active and not user.is_disabled),
            "role_id": membership.role_id,
            "role_name": role.name if role else membership.role,
            "membership_id": membership.id,
            "updated_at": user.updated_at,
        }
        for membership, user, role in q.all()
    ]


def get_user_detail(db: Session, *, tenant_id: str, user_id: str) -> dict:
    row = (
        db.query(Membership, User, Role)
        .join(User, User.id == Membership.user_id)
        .outerjoin(Role, and_(Role.id == Membership.role_id, Role.tenant_id == Membership.tenant_id))
        .filter(Membership.tenant_id == tenant_id, Membership.user_id == user_id)
        .one_or_none()
    )
    if row is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    membership, user, role = row
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_active": bool(user.is_active and not user.is_disabled),
        "role_id": membership.role_id,
        "role_name": role.name if role else membership.role,
        "membership_id": membership.id,
        "membership_created_at": membership.created_at,
        "membership_updated_at": membership.updated_at,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

def create_user(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    email: str,
    display_name: str | None,
    role_id: str,
    password: str | None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    normalized_email = normalize_email(email)
    role = _get_role_for_tenant(db, tenant_id=tenant_id, role_id=role_id)
    existing = db.query(User).filter(User.email == normalized_email).one_or_none()
    if existing:
        if db.get(Membership, {"tenant_id": tenant_id, "user_id": existing.id}):
            raise conflict("User already exists in tenant", code="tenant_user_conflict")
        user = existing
        user.display_name = display_name or user.display_name
        user.is_active = True
        user.is_disabled = False
        user.updated_at = _utcnow()
        db.add(user)
    else:
        raw_password = password or f"Temp-{secrets.token_urlsafe(18)}"
        user = User(
            id=str(uuid4()),
            email=normalized_email,
            display_name=display_name,
            password_hash=hash_password(raw_password),
            is_active=True,
            is_disabled=False,
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(user)
        db.flush()
    db.add(Membership(tenant_id=tenant_id, user_id=user.id, role_id=role.id, role=role.name, created_at=_utcnow(), updated_at=_utcnow()))
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.create",
        entity_type="user",
        entity_id=user.id,
        after={"email": user.email, "display_name": user.display_name, "role_id": role.id, "role_name": role.name},
    )
    return user


def update_user(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    user_id: str,
    email: str | None,
    display_name: str | None,
    is_active: bool | None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    if db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id}) is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    user = db.get(User, user_id)
    if user is None:
        raise not_found("User not found", code="user_not_found")
    before = {"email": user.email, "display_name": user.display_name, "is_active": user.is_active and not user.is_disabled}
    if email is not None:
        normalized_email = normalize_email(email)
        if db.query(User.id).filter(User.email == normalized_email, User.id != user_id).first():
            raise conflict("Email already in use", code="user_email_conflict")
        user.email = normalized_email
    if display_name is not None:
        user.display_name = display_name
    if is_active is not None:
        if not is_active and user_id in _admin_capable_user_ids(db, tenant_id=tenant_id) and not (_admin_capable_user_ids(db, tenant_id=tenant_id) - {user_id}):
            raise validation_error("Cannot remove last admin-equivalent from tenant", code="last_admin_protection")
        user.is_active = is_active
        user.is_disabled = not is_active
    user.updated_at = _utcnow()
    db.add(user)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.update",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={"email": user.email, "display_name": user.display_name, "is_active": user.is_active and not user.is_disabled},
    )
    return user


def change_user_role(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    user_id: str,
    role_id: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> Membership:
    membership = db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})
    if membership is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    role = _get_role_for_tenant(db, tenant_id=tenant_id, role_id=role_id)
    actor_permissions = _user_permission_keys(db, tenant_id=tenant_id, user_id=actor_user_id)
    target_before_permissions = _user_permission_keys(db, tenant_id=tenant_id, user_id=user_id)
    target_after_permissions = {row[0] for row in db.query(RolePermission.permission_key).filter(RolePermission.role_id == role.id).all()}
    if user_id == actor_user_id and ADMIN_ROLES_WRITE not in actor_permissions and target_after_permissions != target_before_permissions:
        raise AppError(code="self_escalation_blocked", message="Cannot change your own role permissions without admin.roles.write", status_code=403)
    if user_id in _admin_capable_user_ids(db, tenant_id=tenant_id) and ADMIN_USERS_WRITE not in target_after_permissions and not (_admin_capable_user_ids(db, tenant_id=tenant_id) - {user_id}):
        raise validation_error("Cannot remove last admin-equivalent from tenant", code="last_admin_protection")
    before = {"role_id": membership.role_id, "role_name": membership.role}
    membership.role_id = role.id
    membership.role = role.name
    membership.updated_at = _utcnow()
    db.add(membership)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.role.update",
        entity_type="user",
        entity_id=user_id,
        before=before,
        after={"role_id": membership.role_id, "role_name": membership.role},
    )
    return membership


def disable_user(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    user_id: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    if db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id}) is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    user = db.get(User, user_id)
    if user is None:
        raise not_found("User not found", code="user_not_found")
    if user_id in _admin_capable_user_ids(db, tenant_id=tenant_id) and not (_admin_capable_user_ids(db, tenant_id=tenant_id) - {user_id}):
        raise validation_error("Cannot remove last admin-equivalent from tenant", code="last_admin_protection")
    disable_user_tokens(db, user=user)
    user.is_active = False
    user.updated_at = _utcnow()
    db.add(user)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.disable",
        entity_type="user",
        entity_id=user_id,
        before={"is_active": True},
        after={"is_active": False},
    )

def create_invite(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    email: str,
    display_name: str | None,
    role_id: str,
    expires_in_days: int,
    base_url: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    role = _get_role_for_tenant(db, tenant_id=tenant_id, role_id=role_id)
    token = secrets.token_urlsafe(32)
    invite = InviteToken(
        id=str(uuid4()),
        tenant_id=tenant_id,
        email=normalize_email(email),
        display_name=(display_name or "").strip() or None,
        role_id=role.id,
        token_hash=_token_hash(token),
        created_by_user_id=actor_user_id,
        expires_at=_utcnow() + timedelta(days=max(1, min(expires_in_days, 30))),
    )
    db.add(invite)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="invite.create",
        entity_type="invite",
        entity_id=invite.id,
        after={"email": invite.email, "role_id": invite.role_id, "expires_at": invite.expires_at.isoformat()},
        metadata={"token": "***REDACTED***"},
    )
    expose_link = _is_dev_mode() or (ADMIN_USERS_WRITE in _user_permission_keys(db, tenant_id=tenant_id, user_id=actor_user_id))
    return {
        "invite_id": invite.id,
        "invite_link": f"{base_url.rstrip('/')}/accept-invite?token={token}" if expose_link else None,
    }


def list_invites(db: Session, *, tenant_id: str, query: str | None = None) -> list[dict]:
    q = db.query(InviteToken, Role.name, User.email).outerjoin(Role, Role.id == InviteToken.role_id).outerjoin(User, User.id == InviteToken.created_by_user_id).filter(InviteToken.tenant_id == tenant_id)
    if query and query.strip():
        needle = f"%{query.strip().lower()}%"
        q = q.filter(or_(func.lower(InviteToken.email).like(needle), func.lower(func.coalesce(Role.name, "")).like(needle)))
    q = q.order_by(InviteToken.created_at.desc())
    now = _utcnow()
    items: list[dict] = []
    for invite, role_name, created_by_email in q.all():
        status = "active"
        if invite.revoked_at:
            status = "revoked"
        elif invite.accepted_at:
            status = "accepted"
        elif invite.expires_at <= now:
            status = "expired"
        items.append(
            {
                "id": invite.id,
                "email": invite.email,
                "display_name": invite.display_name,
                "role_id": invite.role_id,
                "role_name": role_name,
                "created_by": created_by_email,
                "created_at": invite.created_at,
                "expires_at": invite.expires_at,
                "status": status,
            }
        )
    return items


def revoke_invite(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    invite_id: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    invite = db.query(InviteToken).filter(InviteToken.tenant_id == tenant_id, InviteToken.id == invite_id).one_or_none()
    if invite is None:
        raise not_found("Invite not found", code="invite_not_found")
    invite.revoked_at = _utcnow()
    db.add(invite)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="invite.revoke",
        entity_type="invite",
        entity_id=invite.id,
        before={"revoked_at": None},
        after={"revoked_at": invite.revoked_at.isoformat()},
    )


def accept_invite(
    db: Session,
    *,
    token: str,
    password: str,
    display_name: str | None = None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    now = _utcnow()
    invite = db.query(InviteToken).filter(InviteToken.token_hash == _token_hash(token)).one_or_none()
    if invite is None or invite.revoked_at or invite.accepted_at or invite.expires_at <= now:
        raise AppError(code="invite_invalid", message="Invite token is invalid or expired", status_code=400)
    role = db.query(Role).filter(Role.id == invite.role_id, Role.tenant_id == invite.tenant_id).one_or_none()
    if role is None:
        raise AppError(code="invite_invalid_role", message="Invite role is no longer valid", status_code=400)
    existing = db.query(User).filter(User.email == invite.email).one_or_none()
    if existing and db.get(Membership, {"tenant_id": invite.tenant_id, "user_id": existing.id}):
        raise conflict("User already exists in tenant", code="tenant_user_conflict")
    user = existing
    if user is None:
        user = User(
            id=str(uuid4()),
            email=invite.email,
            display_name=display_name or invite.display_name,
            password_hash=hash_password(password),
            is_active=True,
            is_disabled=False,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(password)
        user.display_name = display_name or invite.display_name or user.display_name
        user.is_active = True
        user.is_disabled = False
        user.updated_at = now
        db.add(user)
    db.add(Membership(tenant_id=invite.tenant_id, user_id=user.id, role_id=role.id, role=role.name, created_at=now, updated_at=now))
    invite.accepted_at = now
    invite.accepted_by_user_id = user.id
    db.add(invite)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=invite.tenant_id,
        actor_id=user.id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="invite.accept",
        entity_type="invite",
        entity_id=invite.id,
        after={"user_id": user.id, "email": user.email},
    )
    return {"ok": True, "tenant_id": invite.tenant_id, "user_id": user.id}


def create_password_reset(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    user_id: str,
    expires_in_hours: int,
    base_url: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    membership = db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})
    if membership is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    token = secrets.token_urlsafe(32)
    reset = PasswordResetToken(
        id=str(uuid4()),
        tenant_id=tenant_id,
        user_id=user_id,
        token_hash=_token_hash(token),
        created_by_user_id=actor_user_id,
        expires_at=_utcnow() + timedelta(hours=max(1, min(expires_in_hours, 168))),
    )
    db.add(reset)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.password_reset.create",
        entity_type="user",
        entity_id=user_id,
        metadata={"token": "***REDACTED***"},
    )
    if _is_dev_mode():
        return {"ok": True, "link": f"{base_url.rstrip('/')}/reset-password?token={token}"}
    return {"ok": True, "link": None}


def consume_password_reset(
    db: Session,
    *,
    token: str,
    new_password: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    now = _utcnow()
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == _token_hash(token)).one_or_none()
    if reset is None or reset.consumed_at or reset.expires_at <= now:
        raise AppError(code="password_reset_invalid", message="Password reset token is invalid or expired", status_code=400)
    user = db.get(User, reset.user_id)
    if user is None:
        raise not_found("User not found", code="user_not_found")
    user.password_hash = hash_password(new_password)
    user.updated_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    user.is_active = True
    user.is_disabled = False
    reset.consumed_at = now
    db.add(user)
    db.add(reset)
    revoke_all_refresh_tokens_for_user(db, user_id=user.id, reason="password_reset")
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=reset.tenant_id,
        actor_id=user.id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="user.password_reset.consume",
        entity_type="user",
        entity_id=user.id,
    )
    return {"ok": True}

def list_user_sessions(db: Session, *, tenant_id: str, user_id: str) -> list[dict]:
    if db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id}) is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    rows = db.query(RefreshToken).filter(RefreshToken.user_id == user_id).order_by(RefreshToken.created_at.desc()).all()
    return [
        {
            "session_id": row.id,
            "created_at": row.created_at,
            "last_seen_at": row.last_seen_at,
            "expires_at": row.expires_at,
            "revoked_at": row.revoked_at,
            "revoked_reason": row.revoked_reason,
            "user_agent_hash": row.user_agent_hash,
            "ip_hash": row.ip_hash,
            "is_active": row.revoked_at is None and row.expires_at > _utcnow(),
        }
        for row in rows
    ]


def revoke_user_sessions(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    user_id: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    if db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id}) is None:
        raise not_found("User membership not found", code="tenant_user_not_found")
    count = revoke_all_refresh_tokens_for_user(db, user_id=user_id, reason="admin_revoke_all_sessions")
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="session.revoke_all",
        entity_type="user",
        entity_id=user_id,
        after={"revoked_count": count},
    )
    return {"ok": True, "revoked_count": count}


def revoke_one_session(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    session_id: str,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    row = db.get(RefreshToken, session_id)
    if row is None:
        raise not_found("Session not found", code="session_not_found")
    if db.get(Membership, {"tenant_id": tenant_id, "user_id": row.user_id}) is None:
        raise not_found("Session not found", code="session_not_found")
    if row.revoked_at is None:
        row.revoked_at = _utcnow()
        row.revoked_reason = "admin_revoke_session"
        db.add(row)
        db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="session.revoke_one",
        entity_type="session",
        entity_id=session_id,
        after={"user_id": row.user_id},
    )
    return {"ok": True, "session_id": session_id}


def bulk_users(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    action: str,
    user_ids: list[str],
    role_id: str | None = None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    normalized_action = action.strip().lower()
    if normalized_action not in {"disable", "set_role"}:
        raise validation_error("Unsupported bulk action", code="bulk_action_invalid")
    unique_ids = sorted({uid for uid in user_ids if uid})
    if not unique_ids:
        raise validation_error("At least one user id is required", code="bulk_user_ids_required")
    if normalized_action == "set_role" and not role_id:
        raise validation_error("role_id is required for set_role", code="bulk_role_required")

    failures: list[dict] = []
    successes: list[str] = []
    if normalized_action == "disable":
        admin_ids = _admin_capable_user_ids(db, tenant_id=tenant_id)
        impacted = admin_ids.intersection(unique_ids)
        if impacted and not (admin_ids - impacted):
            raise validation_error("Bulk operation would remove last admin-equivalent user", code="last_admin_protection")

    for uid in unique_ids:
        try:
            with db.begin_nested():
                if normalized_action == "disable":
                    disable_user(
                        db,
                        tenant_id=tenant_id,
                        actor_user_id=actor_user_id,
                        user_id=uid,
                        actor_ip=actor_ip,
                        user_agent=user_agent,
                    )
                else:
                    change_user_role(
                        db,
                        tenant_id=tenant_id,
                        actor_user_id=actor_user_id,
                        user_id=uid,
                        role_id=str(role_id),
                        actor_ip=actor_ip,
                        user_agent=user_agent,
                    )
            successes.append(uid)
        except AppError as exc:
            failures.append({"user_id": uid, "code": exc.code, "message": exc.message})
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action=f"user.bulk.{normalized_action}",
        entity_type="user",
        entity_id=",".join(unique_ids[:10]),
        after={"requested_count": len(unique_ids), "success_count": len(successes), "failure_count": len(failures)},
    )
    return {"action": normalized_action, "successes": successes, "failures": failures}


def list_feature_flag_catalog(db: Session) -> list[dict]:
    ensure_feature_flag_catalog(db)
    return [
        {"key": row.key, "description": row.description, "default_value": row.default_value}
        for row in db.query(FeatureFlag).order_by(FeatureFlag.key.asc()).all()
    ]


def list_feature_overrides(db: Session, *, tenant_id: str) -> dict:
    tenant = [
        {"flag_key": row.flag_key, "value": row.value, "enabled": row.enabled, "updated_at": row.updated_at}
        for row in db.query(TenantFeatureOverride).filter(TenantFeatureOverride.tenant_id == tenant_id).all()
    ]
    role = [
        {"role_id": row.role_id, "flag_key": row.flag_key, "value": row.value, "enabled": row.enabled, "updated_at": row.updated_at}
        for row in db.query(RoleFeatureOverride).filter(RoleFeatureOverride.tenant_id == tenant_id).all()
    ]
    user = [
        {"user_id": row.user_id, "flag_key": row.flag_key, "value": row.value, "enabled": row.enabled, "updated_at": row.updated_at}
        for row in db.query(UserFeatureOverride).filter(UserFeatureOverride.tenant_id == tenant_id).all()
    ]
    return {"tenant": tenant, "role": role, "user": user}


def upsert_feature_override(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    scope: str,
    flag_key: str,
    value: bool | str | int | float | dict | list | None,
    role_id: str | None = None,
    user_id: str | None = None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    ensure_feature_flag_catalog(db)
    key = flag_key.strip()
    if db.query(FeatureFlag.key).filter(FeatureFlag.key == key).first() is None:
        raise validation_error("Unknown feature flag key", code="feature_flag_not_found")
    scope_norm = scope.strip().lower()
    before: dict | None = None
    after: dict | None = None
    if scope_norm == "tenant":
        row = db.query(TenantFeatureOverride).filter(TenantFeatureOverride.tenant_id == tenant_id, TenantFeatureOverride.flag_key == key).one_or_none()
        before = {"value": row.value, "enabled": row.enabled} if row else None
        if row is None:
            row = TenantFeatureOverride(id=str(uuid4()), tenant_id=tenant_id, flag_key=key, value=value, enabled=True)
        else:
            row.value = value
            row.enabled = True
            row.updated_at = _utcnow()
        db.add(row)
        after = {"value": row.value, "enabled": row.enabled}
    elif scope_norm == "role":
        if not role_id:
            raise validation_error("role_id is required for role scope", code="feature_flag_role_id_required")
        _get_role_for_tenant(db, tenant_id=tenant_id, role_id=role_id)
        row = db.query(RoleFeatureOverride).filter(RoleFeatureOverride.tenant_id == tenant_id, RoleFeatureOverride.role_id == role_id, RoleFeatureOverride.flag_key == key).one_or_none()
        before = {"value": row.value, "enabled": row.enabled} if row else None
        if row is None:
            row = RoleFeatureOverride(id=str(uuid4()), tenant_id=tenant_id, role_id=role_id, flag_key=key, value=value, enabled=True)
        else:
            row.value = value
            row.enabled = True
            row.updated_at = _utcnow()
        db.add(row)
        after = {"role_id": role_id, "value": row.value, "enabled": row.enabled}
    elif scope_norm == "user":
        if not user_id:
            raise validation_error("user_id is required for user scope", code="feature_flag_user_id_required")
        if db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id}) is None:
            raise validation_error("Invalid user_id for tenant", code="tenant_user_not_found")
        row = db.query(UserFeatureOverride).filter(UserFeatureOverride.tenant_id == tenant_id, UserFeatureOverride.user_id == user_id, UserFeatureOverride.flag_key == key).one_or_none()
        before = {"value": row.value, "enabled": row.enabled} if row else None
        if row is None:
            row = UserFeatureOverride(id=str(uuid4()), tenant_id=tenant_id, user_id=user_id, flag_key=key, value=value, enabled=True)
        else:
            row.value = value
            row.enabled = True
            row.updated_at = _utcnow()
        db.add(row)
        after = {"user_id": user_id, "value": row.value, "enabled": row.enabled}
    else:
        raise validation_error("Unsupported scope", code="feature_flag_scope_invalid")
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="feature_flag.override.upsert",
        entity_type="feature_flag",
        entity_id=key,
        metadata={"scope": scope_norm, "role_id": role_id, "user_id": user_id},
        before=before,
        after=after,
    )
    return {"ok": True}

def delete_feature_override(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    scope: str,
    flag_key: str,
    role_id: str | None = None,
    user_id: str | None = None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    scope_norm = scope.strip().lower()
    key = flag_key.strip()
    deleted = 0
    before: dict | None = None
    if scope_norm == "tenant":
        row = db.query(TenantFeatureOverride).filter(TenantFeatureOverride.tenant_id == tenant_id, TenantFeatureOverride.flag_key == key).one_or_none()
        if row:
            before = {"value": row.value, "enabled": row.enabled}
            db.delete(row)
            deleted = 1
    elif scope_norm == "role":
        if not role_id:
            raise validation_error("role_id is required for role scope", code="feature_flag_role_id_required")
        row = db.query(RoleFeatureOverride).filter(RoleFeatureOverride.tenant_id == tenant_id, RoleFeatureOverride.role_id == role_id, RoleFeatureOverride.flag_key == key).one_or_none()
        if row:
            before = {"value": row.value, "enabled": row.enabled}
            db.delete(row)
            deleted = 1
    elif scope_norm == "user":
        if not user_id:
            raise validation_error("user_id is required for user scope", code="feature_flag_user_id_required")
        row = db.query(UserFeatureOverride).filter(UserFeatureOverride.tenant_id == tenant_id, UserFeatureOverride.user_id == user_id, UserFeatureOverride.flag_key == key).one_or_none()
        if row:
            before = {"value": row.value, "enabled": row.enabled}
            db.delete(row)
            deleted = 1
    else:
        raise validation_error("Unsupported scope", code="feature_flag_scope_invalid")
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="feature_flag.override.delete",
        entity_type="feature_flag",
        entity_id=key,
        metadata={"scope": scope_norm, "role_id": role_id, "user_id": user_id},
        before=before,
    )
    return {"ok": True, "deleted": deleted}


def get_tenant_profile(db: Session, *, tenant_id: str) -> dict:
    row = db.get(TenantProfile, tenant_id)
    if row is None:
        return {
            "tenant_id": tenant_id,
            "display_name": None,
            "legal_name": None,
            "address_line1": None,
            "address_line2": None,
            "city": None,
            "state": None,
            "postal_code": None,
            "phone": None,
            "logo_url": None,
            "theme": {},
        }
    return {
        "tenant_id": row.tenant_id,
        "display_name": row.display_name,
        "legal_name": row.legal_name,
        "address_line1": row.address_line1,
        "address_line2": row.address_line2,
        "city": row.city,
        "state": row.state,
        "postal_code": row.postal_code,
        "phone": row.phone,
        "logo_url": row.logo_url,
        "theme": row.theme,
    }


def update_tenant_profile(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    payload: dict,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    row = db.get(TenantProfile, tenant_id)
    if row is None:
        row = TenantProfile(tenant_id=tenant_id, created_at=_utcnow(), updated_at=_utcnow(), theme={})
    before = get_tenant_profile(db, tenant_id=tenant_id)
    for field in ("display_name", "legal_name", "address_line1", "address_line2", "city", "state", "postal_code", "phone"):
        if field in payload:
            setattr(row, field, payload.get(field))
    row.updated_at = _utcnow()
    db.add(row)
    db.flush()
    after = get_tenant_profile(db, tenant_id=tenant_id)
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="tenant.profile.update",
        entity_type="tenant",
        entity_id=tenant_id,
        before=before,
        after=after,
    )
    return after


def set_tenant_logo_url(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    logo_url: str | None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    row = db.get(TenantProfile, tenant_id)
    if row is None:
        row = TenantProfile(tenant_id=tenant_id, theme={}, created_at=_utcnow(), updated_at=_utcnow())
    before = {"logo_url": row.logo_url}
    row.logo_url = (logo_url or "").strip() or None
    row.updated_at = _utcnow()
    db.add(row)
    db.flush()
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="tenant.logo.update",
        entity_type="tenant",
        entity_id=tenant_id,
        before=before,
        after={"logo_url": row.logo_url},
    )
    return {"logo_url": row.logo_url}


def get_tenant_theme(db: Session, *, tenant_id: str) -> dict:
    row = db.get(TenantProfile, tenant_id)
    if row is None:
        return {"accent_color": "#0b5ed7", "logo_variant": "default", "sidebar_style": "default", "print_header_enabled": False}
    theme = dict(row.theme or {})
    return {
        "accent_color": theme.get("accent_color", "#0b5ed7"),
        "logo_variant": theme.get("logo_variant", "default"),
        "sidebar_style": theme.get("sidebar_style", "default"),
        "print_header_enabled": bool(theme.get("print_header_enabled", False)),
    }


def update_tenant_theme(
    db: Session,
    *,
    tenant_id: str,
    actor_user_id: str,
    theme_payload: dict,
    actor_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    row = db.get(TenantProfile, tenant_id)
    if row is None:
        row = TenantProfile(tenant_id=tenant_id, theme={}, created_at=_utcnow(), updated_at=_utcnow())
    before = get_tenant_theme(db, tenant_id=tenant_id)
    theme = dict(row.theme or {})
    for field in ("accent_color", "logo_variant", "sidebar_style", "print_header_enabled"):
        if field in theme_payload:
            theme[field] = theme_payload.get(field)
    row.theme = theme
    row.updated_at = _utcnow()
    db.add(row)
    db.flush()
    after = get_tenant_theme(db, tenant_id=tenant_id)
    log_audit_event(
        db=db,
        tenant_id=tenant_id,
        actor_id=actor_user_id,
        actor_ip=actor_ip,
        user_agent=user_agent,
        action="tenant.theme.update",
        entity_type="tenant",
        entity_id=tenant_id,
        before=before,
        after=after,
    )
    return after


def list_audit_events(
    db: Session,
    *,
    tenant_id: str,
    actor: str | None = None,
    action: str | None = None,
    ts_from: datetime | None = None,
    ts_to: datetime | None = None,
) -> list[dict]:
    q = db.query(AuditEvent, User.email).outerjoin(User, User.id == AuditEvent.actor_id).filter(AuditEvent.tenant_id == tenant_id)
    if actor and actor.strip():
        q = q.filter(or_(AuditEvent.actor_id == actor.strip(), func.lower(User.email).like(f"%{actor.strip().lower()}%")))
    if action and action.strip():
        q = q.filter(AuditEvent.action == action.strip())
    if ts_from:
        q = q.filter(AuditEvent.ts >= ts_from)
    if ts_to:
        q = q.filter(AuditEvent.ts <= ts_to)
    q = q.order_by(AuditEvent.ts.desc())
    return [
        {
            "id": event.id,
            "tenant_id": event.tenant_id,
            "actor_user_id": event.actor_id,
            "actor_email": email,
            "action": event.action,
            "target_type": event.entity_type,
            "target_id": event.entity_id,
            "timestamp": event.ts,
            "request_id": event.request_id,
            "actor_ip": event.actor_ip,
            "user_agent": event.user_agent,
            "diff": {"before": event.before, "after": event.after, "metadata": event.metadata_json},
        }
        for event, email in q.all()
    ]


def export_audit_events(
    db: Session,
    *,
    tenant_id: str,
    ts_from: datetime | None = None,
    ts_to: datetime | None = None,
    fmt: str = "json",
):
    items = list_audit_events(db, tenant_id=tenant_id, ts_from=ts_from, ts_to=ts_to)
    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "actor_user_id", "actor_email", "action", "target_type", "target_id", "request_id", "actor_ip", "user_agent"])
        for row in items:
            writer.writerow([row["timestamp"], row["actor_user_id"], row["actor_email"], row["action"], row["target_type"], row["target_id"], row["request_id"], row.get("actor_ip"), row.get("user_agent")])
        return "text/csv", output.getvalue()
    return "application/json", {"items": items, "request_id": get_request_id()}
