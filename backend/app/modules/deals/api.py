from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import (
    finalize_idempotent_request,
    idempotency_guard,
    start_idempotent_request,
)
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.audit.service import log_audit_event
from app.modules.deals.schemas import DealCreate, DealDocOut, DealQueueItem, DealTransition
from app.modules.deals.service import (
    allowed_actions_for_state,
    create_deal,
    get_deal_doc,
    transition_deal,
)
from app.modules.documents.models import Document
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/deals",
    tags=["deals"],
    dependencies=[Depends(get_current_user), Depends(require_permission(Permission.DEALS_READ))],
)


@router.post("", response_model=DealDocOut)
def create(
    payload: DealCreate,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DEALS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="deals.create",
            idempotency_key=idempotency_key,
            request_payload=payload.model_dump(mode="json"),
        )
        if idmp.replay is not None:
            return DealDocOut.model_validate(idmp.replay)

        request.state.audit_action = "deal.create"
        request.state.audit_entity_type = "deal"
        request.state.audit_entity_id = payload.deal_id
        doc = create_deal(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            deal_id=payload.deal_id,
            customer_id=payload.customer_id,
            vehicle_id=payload.vehicle_id,
            quote_amount_cents=payload.quote_amount_cents,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="deal.create",
            entity_type="deal",
            entity_id=payload.deal_id,
            after={"state": (doc.document or {}).get("state")},
        )
        out = DealDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="deal_doc",
            resource_id=out.doc_id,
        )
        return out


@router.post("/{deal_id}/transition", response_model=DealDocOut)
def transition(
    deal_id: str,
    payload: DealTransition,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DEALS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="deals.transition",
            idempotency_key=idempotency_key,
            request_payload={"deal_id": deal_id, **payload.model_dump(mode="json")},
        )
        if idmp.replay is not None:
            return DealDocOut.model_validate(idmp.replay)

        request.state.audit_action = "deal.transition"
        request.state.audit_entity_type = "deal"
        request.state.audit_entity_id = deal_id
        doc = transition_deal(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            deal_id=deal_id,
            to_state=payload.to_state,
            reason=payload.reason,
            payload=payload.payload,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="deal.transition",
            entity_type="deal",
            entity_id=deal_id,
            reason=payload.reason,
            after={"state": (doc.document or {}).get("state")},
            metadata={"to_state": payload.to_state},
        )
        out = DealDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="deal_doc",
            resource_id=out.doc_id,
        )
        return out


@router.get("/{deal_id}", response_model=DealDocOut)
def get_one(deal_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    doc = get_deal_doc(db=db, tenant_id=tenant_id, deal_id=deal_id)
    if doc is None:
        raise AppError(code="deal_not_found", message="Deal not found", status_code=404)
    out = DealDocOut.model_validate(doc)
    return out.model_copy(update={"allowed_actions": allowed_actions_for_state((doc.document or {}).get("state"))})


@router.get("/queue/by-state", response_model=PageResult[DealQueueItem])
def queue_by_state(
    state: str | None = None,
    q: str | None = Query(default=None, description="Optional text search in deal JSON"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == "deal_summary")
    if state:
        qry = qry.filter(Document.document["state"].astext == state)
    if q and q.strip():
        qry = qry.filter(Document.document.cast(str).ilike(f"%{q.strip()}%"))
    if sort.fields:
        qry = apply_sort(qry, Document, sort, allowed={"doc_id", "updated_at", "version"})
    else:
        qry = qry.order_by(Document.updated_at.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda d: DealQueueItem(
            deal_id=d.doc_id,
            state=((d.document or {}).get("state") or "quote"),
            customer_id=(d.document or {}).get("customer_id"),
            vehicle_id=(d.document or {}).get("vehicle_id"),
            updated_at=d.updated_at,
        ),
    )
