from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_items
from app.core.querying import Page, Sort, page_params, parse_sort_fields, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.integrations.schemas import (
    OutboxDrainResult,
    WebhookCreate,
    WebhookOut,
    WebhookUpdate,
)
from app.modules.integrations.service import (
    create_webhook,
    drain_outbox,
    list_webhooks,
    update_webhook,
)
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/integrations",
    tags=["integrations"],
    dependencies=[
        Depends(get_current_user),
        Depends(require_permission(Permission.INTEGRATIONS_READ)),
    ],
)


@router.get("/webhooks", response_model=PageResult[WebhookOut])
def webhooks_list(
    q: str | None = Query(default=None, description="Optional search in webhook URL"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    hooks = list_webhooks(db=db, tenant_id=tenant_id)
    if q and q.strip():
        like = q.strip().lower()
        hooks = [h for h in hooks if like in (getattr(h, "url", "") or "").lower()]

    if sort.fields:
        for name, desc in reversed(
            parse_sort_fields(sort, allowed={"id", "url", "enabled", "created_at", "updated_at"})
        ):
            if name == "id":
                hooks = sorted(hooks, key=lambda h: h.id, reverse=desc)
            elif name == "url":
                hooks = sorted(hooks, key=lambda h: h.url, reverse=desc)
            elif name == "enabled":
                hooks = sorted(hooks, key=lambda h: h.enabled, reverse=desc)
            elif name == "created_at":
                hooks = sorted(hooks, key=lambda h: h.created_at, reverse=desc)
            else:
                hooks = sorted(hooks, key=lambda h: h.updated_at, reverse=desc)

    return paginate_items(
        hooks,
        page=page,
        item_map=lambda h: WebhookOut.model_validate(h),
    )


@router.post("/webhooks", response_model=WebhookOut)
def webhooks_create(
    payload: WebhookCreate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _perm=Depends(require_permission(Permission.INTEGRATIONS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        wh = create_webhook(
            db=db,
            tenant_id=tenant_id,
            url=payload.url,
            secret=payload.secret,
            enabled=payload.enabled,
            event_types=payload.event_types,
        )
        return WebhookOut.model_validate(wh)


@router.patch("/webhooks/{webhook_id}", response_model=WebhookOut)
def webhooks_update(
    webhook_id: str,
    payload: WebhookUpdate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _perm=Depends(require_permission(Permission.INTEGRATIONS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        wh = update_webhook(
            db=db,
            tenant_id=tenant_id,
            webhook_id=webhook_id,
            url=payload.url,
            secret=payload.secret,
            enabled=payload.enabled,
            event_types=payload.event_types,
        )
        return WebhookOut.model_validate(wh)


@router.post("/outbox/drain", response_model=OutboxDrainResult)
def outbox_drain(
    request: Request,
    limit: int = Query(default=200, ge=1, le=1000),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _perm=Depends(require_permission(Permission.INTEGRATIONS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    request.state.audit_action = "integrations.outbox.drain"
    with uow as db:
        res = drain_outbox(db=db, tenant_id=tenant_id, limit=limit)
        return OutboxDrainResult(**res)
