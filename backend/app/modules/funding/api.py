from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.errors import not_found
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
from app.modules.documents.models import Document
from app.modules.funding.schemas import (
    FundingDealCreate,
    FundingDocOut,
    FundingEventAppend,
    FundingQueueItem,
)
from app.modules.funding.service import (
    allowed_actions_for_status,
    append_funding_event,
    create_deal,
    get_deal_doc,
)
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/funding",
    tags=["funding"],
    dependencies=[Depends(get_current_user), Depends(require_permission(Permission.FUNDING_READ))],
)


@router.post("/deals", response_model=FundingDocOut)
def create(payload: FundingDealCreate, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.FUNDING_WRITE)),
    _idmp=Depends(idempotency_guard),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="funding.deals.create",
            idempotency_key=idempotency_key,
            request_payload=payload.model_dump(mode="json"),
        )
        if idmp.replay is not None:
            return FundingDocOut.model_validate(idmp.replay)
        request.state.audit_action = "funding.deal.create"
        request.state.audit_entity_type = "funding"
        request.state.audit_entity_id = payload.deal_id
        doc = create_deal(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            deal_id=payload.deal_id,
            customer_name=payload.customer_name,
            vehicle=payload.vehicle,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="funding.deal.create",
            entity_type="funding_deal",
            entity_id=payload.deal_id,
            after={"status": (doc.document or {}).get("status")},
            metadata={"customer_name": payload.customer_name, "vehicle": payload.vehicle},
        )
        out = FundingDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="funding_doc",
            resource_id=out.doc_id,
        )
        return out


@router.post("/deals/{deal_id}/events", response_model=FundingDocOut)
def append_event(deal_id: str,
    payload: FundingEventAppend,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.FUNDING_WRITE)),
    _idmp=Depends(idempotency_guard),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="funding.deals.append_event",
            idempotency_key=idempotency_key,
            request_payload={"deal_id": deal_id, **payload.model_dump(mode="json")},
        )
        if idmp.replay is not None:
            return FundingDocOut.model_validate(idmp.replay)
        request.state.audit_action = payload.event_type
        request.state.audit_entity_type = "funding"
        request.state.audit_entity_id = deal_id
        doc = append_funding_event(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            deal_id=deal_id,
            event_type=payload.event_type,
            payload=payload.payload or {},
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action=payload.event_type,
            entity_type="funding_deal",
            entity_id=deal_id,
            metadata={"event_payload": payload.payload or {}},
            after={"status": (doc.document or {}).get("status")},
        )
        out = FundingDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="funding_doc",
            resource_id=out.doc_id,
        )
        return out


@router.get("/deals/{deal_id}", response_model=FundingDocOut)
def get_deal(deal_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    doc = get_deal_doc(db=db, tenant_id=tenant_id, deal_id=deal_id)
    if doc is None:
        raise not_found("Funding deal not found", code="funding_not_found")
    out = FundingDocOut.model_validate(doc)
    return out.model_copy(update={"allowed_actions": allowed_actions_for_status((doc.document or {}).get("status"))})


@router.get("/queue", response_model=PageResult[FundingQueueItem])
def queue(
    status: str | None = None,
    q: str | None = Query(default=None, description="Optional search across funding checklist JSON"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == "funding_checklist")
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
        item_map=lambda d: FundingQueueItem(
                deal_id=d.doc_id,
                status=(d.document or {}).get("status"),
                customer_name=(d.document or {}).get("customer_name"),
                lender=((d.document or {}).get("lender") or {}).get("name")
                if isinstance((d.document or {}).get("lender"), dict)
                else (d.document or {}).get("lender"),
                stips_outstanding=int((d.document or {}).get("stips_outstanding") or 0),
                updated_at=d.updated_at,
            ),
    )
