from __future__ import annotations

from datetime import datetime

from app.core.errors import AppError
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.db.session import get_db
from app.modules.audit.models import AuditEvent
from app.modules.audit.schemas import AuditEventOut
from app.modules.audit.service import query_audit_events
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/audit",
    tags=["audit"],
    dependencies=[Depends(require_permission(Permission.AUDIT_READ))],
)


@router.get("/events", response_model=PageResult[AuditEventOut])
def list_audit_events(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    ts_from: datetime | None = Query(default=None),
    ts_to: datetime | None = Query(default=None),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> PageResult[AuditEventOut]:
    qry = query_audit_events(
        db=db,
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        action=action,
        ts_from=ts_from,
        ts_to=ts_to,
    )
    if sort.fields:
        qry = apply_sort(
            qry,
            AuditEvent,
            sort,
            allowed={"ts", "action", "entity_type", "entity_id", "actor_id"},
        )
    else:
        qry = qry.order_by(AuditEvent.ts.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda e: AuditEventOut.model_validate(e, from_attributes=True),
    )


@router.get("/events/{event_id}", response_model=AuditEventOut)
def get_audit_event(
    event_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> AuditEventOut:
    event = (
        db.query(AuditEvent)
        .filter(AuditEvent.tenant_id == tenant_id, AuditEvent.id == event_id)
        .one_or_none()
    )
    if event is None:
        raise AppError(code="audit_event_not_found", message="Audit event not found", status_code=404)
    return AuditEventOut.model_validate(event, from_attributes=True)
