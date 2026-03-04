from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_items
from app.core.querying import Page, Sort, page_params, parse_sort_fields, sort_params
from app.core.tenancy.deps import get_current_tenant
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.identity.models import User
from app.modules.rbac.service import ensure_default_admin_role
from app.modules.tenancy import service
from app.modules.tenancy.models import Tenant
from app.modules.tenancy.schemas import MyTenantOut, TenantCreate, TenantOut
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/tenants",
    tags=["tenants"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
    _idmp=Depends(idempotency_guard),
):
    try:
        with uow as db:
            t = service.create_tenant(db, payload.name, auto_commit=False)
            admin_role = ensure_default_admin_role(db, tenant_id=t.id)
            # creator becomes admin
            service.upsert_membership(
                db,
                tenant_id=t.id,
                user_id=current_user.id,
                role="ADMIN",
                role_id=admin_role.id,
                auto_commit=False,
            )
            return TenantOut(id=t.id, name=t.name)
    except Exception as exc:
        msg = str(exc).lower()
        if "unique" in msg or "duplicate" in msg:
            raise AppError(
                code="tenant_name_conflict",
                message="Tenant name already exists",
                status_code=409,
            ) from exc
        raise


@router.get("/mine", response_model=PageResult[MyTenantOut])
def list_my_tenants(
    q: str | None = Query(default=None, description="Optional search by tenant name or role"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return only tenants the current user is a member of, with their role.
    Paged in-memory since service.list_user_tenants currently returns a list.
    """
    rows = service.list_user_tenants(db, user_id=current_user.id)
    items = [MyTenantOut(id=t.id, name=t.name, role=(m.role or "USER").upper()) for (t, m) in rows]

    if q and q.strip():
        needle = q.strip().lower()
        items = [x for x in items if needle in x.name.lower() or needle in x.role.lower()]

    if sort.fields:
        for name, desc in reversed(parse_sort_fields(sort, allowed={"id", "name", "role"})):
            if name == "id":
                items = sorted(items, key=lambda x: x.id, reverse=desc)
            elif name == "name":
                items = sorted(items, key=lambda x: x.name, reverse=desc)
            else:
                items = sorted(items, key=lambda x: x.role, reverse=desc)

    return paginate_items(
        items,
        page=page,
        item_map=lambda x: x,
    )


@router.get("/current", response_model=MyTenantOut)
def current_tenant(
    request: Request,
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Convenience endpoint for SPAs:
    Requires Authorization + X-Tenant-Id.
    Returns the current tenant + the caller's role in that tenant.
    """
    role = (getattr(request.state, "tenant_role", None) or "USER").upper()
    return MyTenantOut(id=tenant.id, name=tenant.name, role=role)
