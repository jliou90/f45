from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.audit.service import log_audit_event
from app.modules.documents.models import Document
from app.modules.service_ro.schemas import ROCreate, RODocOut, ROEventAppend, ROQueueItem
from app.modules.service_ro.service import (
    allowed_actions_for_status,
    append_ro_event,
    create_ro,
    get_ro_doc,
)
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/service",
    tags=["service"],
    dependencies=[Depends(get_current_user), Depends(require_permission(Permission.SERVICE_RO_READ))],
)


@router.post("/ros", response_model=RODocOut)
def create(payload: ROCreate, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.SERVICE_RO_WRITE)),
    _idmp=Depends(idempotency_guard),):
    request.state.audit_action = "service.ro.create"
    request.state.audit_entity_type = "ro"
    request.state.audit_entity_id = payload.ro_id
    with uow as db:
        doc = create_ro(db=db, tenant_id=tenant_id, actor=user, ro_id=payload.ro_id, customer_name=payload.customer_name, vehicle=payload.vehicle)
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="service.ro.create",
            entity_type="ro",
            entity_id=payload.ro_id,
            after={"status": (doc.document or {}).get("status")},
        )
        return RODocOut.model_validate(doc)


@router.post("/ros/{ro_id}/events", response_model=RODocOut)
def append_event(ro_id: str, payload: ROEventAppend, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.SERVICE_RO_WRITE)),
    _idmp=Depends(idempotency_guard),):
    request.state.audit_action = payload.event_type
    request.state.audit_entity_type = "ro"
    request.state.audit_entity_id = ro_id
    with uow as db:
        doc = append_ro_event(db=db, tenant_id=tenant_id, actor=user, ro_id=ro_id, event_type=payload.event_type, payload=payload.payload)
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action=payload.event_type,
            entity_type="ro",
            entity_id=ro_id,
            metadata={"payload": payload.payload or {}},
            after={"status": (doc.document or {}).get("status")},
        )
        return RODocOut.model_validate(doc)


@router.get("/ros/{ro_id}", response_model=RODocOut)
def get_one(ro_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    doc = get_ro_doc(db=db, tenant_id=tenant_id, ro_id=ro_id)
    if doc is None:
        raise AppError(code="ro_not_found", message="RO not found", status_code=404)
    out = RODocOut.model_validate(doc)
    return out.model_copy(update={"allowed_actions": allowed_actions_for_status((doc.document or {}).get("status"))})


@router.get("/queue", response_model=PageResult[ROQueueItem])
def queue(
    status: str | None = None,
    q: str | None = Query(default=None, description="Optional search across RO summary JSON"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == "ro_summary")
    if status:
        qry = qry.filter(Document.document["status"].astext == status)
    if q and q.strip():
        qry = qry.filter(Document.document.cast(str).ilike(f"%{q.strip()}%"))

    if sort.fields:
        qry = apply_sort(
            qry,
            Document,
            sort,
            allowed={"doc_id", "updated_at", "version"},
        )
    else:
        qry = qry.order_by(Document.updated_at.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda d: ROQueueItem(
                ro_id=d.doc_id,
                status=(d.document or {}).get("status"),
                customer_name=(d.document or {}).get("customer_name"),
                vehicle=(d.document or {}).get("vehicle"),
                updated_at=d.updated_at,
            ),
    )
