from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.core.uow import commit_session
from app.modules.tenancy.models import Membership, Tenant
from sqlalchemy import select
from sqlalchemy.orm import Session


def list_user_tenants(db: Session, *, user_id: str) -> list[tuple[Tenant, Membership]]:
    stmt = (
        select(Tenant, Membership)
        .join(Membership, Membership.tenant_id == Tenant.id)
        .where(Membership.user_id == user_id)
        .order_by(Tenant.name.asc())
    )
    return list(db.execute(stmt).all())


def create_tenant(db: Session, name: str, *, auto_commit: bool = True) -> Tenant:
    tenant = Tenant(id=str(uuid4()), name=name)
    db.add(tenant)
    if auto_commit:
        commit_session(db)
    else:
        db.flush()
    db.refresh(tenant)
    return tenant


def list_tenants(db: Session) -> list[Tenant]:
    return list(db.execute(select(Tenant).order_by(Tenant.name.asc())).scalars().all())


def get_tenant(db: Session, tenant_id: str) -> Tenant | None:
    return db.get(Tenant, tenant_id)


def get_membership(db: Session, *, tenant_id: str, user_id: str) -> Membership | None:
    return db.get(Membership, {"tenant_id": tenant_id, "user_id": user_id})


def upsert_membership(
    db: Session,
    *,
    tenant_id: str,
    user_id: str,
    role: str,
    role_id: str | None = None,
    auto_commit: bool = True,
) -> Membership:
    role = _normalize_role(role)

    m = get_membership(db, tenant_id=tenant_id, user_id=user_id)
    if m:
        if m.role != role or m.role_id != role_id:
            m.role = role
            m.role_id = role_id
            m.updated_at = datetime.now(UTC)
            db.add(m)
            if auto_commit:
                commit_session(db)
            else:
                db.flush()
            db.refresh(m)
        return m

    m = Membership(tenant_id=tenant_id, user_id=user_id, role=role, role_id=role_id)
    db.add(m)
    if auto_commit:
        commit_session(db)
    else:
        db.flush()
    db.refresh(m)
    return m

def _normalize_role(role: str) -> str:
    return (role or "").strip().upper() or "USER"
