from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.comms.models import OutboundCommunication
from app.modules.comms.schemas import OutboundCommunicationOut, SendCustomerEmailIn, SendLenderStipIn
from app.modules.comms.service import send_customer_email, send_lender_stip
from app.modules.dms.models import Customer
from app.modules.identity.models import User
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/comms", tags=["comms"], dependencies=[Depends(get_current_user)])


@router.post(
    "/customers/{customer_id}/email",
    response_model=OutboundCommunicationOut,
    dependencies=[Depends(require_permission(Permission.COMMS_CUSTOMER_WRITE))],
)
def customer_email(
    customer_id: str,
    payload: SendCustomerEmailIn,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user: User = Depends(get_current_user),
    _idmp=Depends(idempotency_guard),
) -> OutboundCommunicationOut:
    with uow as db:
        customer = (
            db.query(Customer)
            .filter(Customer.tenant_id == tenant_id, Customer.id == customer_id, Customer.is_deleted.is_(False))
            .one_or_none()
        )
        if customer is None:
            from app.core.errors import AppError

            raise AppError(code="customer_not_found", message="Customer not found", status_code=404)
        row = send_customer_email(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            customer_id=customer_id,
            to_email=str(payload.to_email),
            subject=payload.subject,
            body=payload.body,
            attachment_id=payload.attachment_id,
        )
        return OutboundCommunicationOut.model_validate(row)


@router.get(
    "/customers/{customer_id}",
    response_model=PageResult[OutboundCommunicationOut],
    dependencies=[Depends(require_permission(Permission.COMMS_CUSTOMER_READ))],
)
def customer_messages(
    customer_id: str,
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> PageResult[OutboundCommunicationOut]:
    qry = db.query(OutboundCommunication).filter(
        OutboundCommunication.tenant_id == tenant_id,
        OutboundCommunication.entity_type == "customer",
        OutboundCommunication.entity_id == customer_id,
    )
    if sort.fields:
        qry = apply_sort(qry, OutboundCommunication, sort, allowed={"created_at", "status", "to_address"})
    else:
        qry = qry.order_by(OutboundCommunication.created_at.desc())
    return paginate_query(qry, page=page, item_map=OutboundCommunicationOut.model_validate)


@router.post(
    "/funding/{deal_id}/stip",
    response_model=OutboundCommunicationOut,
    dependencies=[Depends(require_permission(Permission.COMMS_FUNDING_WRITE))],
)
def funding_stip_send(
    deal_id: str,
    payload: SendLenderStipIn,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user: User = Depends(get_current_user),
    _idmp=Depends(idempotency_guard),
) -> OutboundCommunicationOut:
    with uow as db:
        row = send_lender_stip(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            deal_id=deal_id,
            lender_email=str(payload.lender_email),
            stip_name=payload.stip_name,
            subject=payload.subject,
            note=payload.note,
            attachment_id=payload.attachment_id,
        )
        return OutboundCommunicationOut.model_validate(row)
