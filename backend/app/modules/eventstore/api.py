from __future__ import annotations

import logging
from typing import Any

from app.core.auth.deps import get_current_user
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.eventstore.models import Event
from app.modules.eventstore.schemas import EventAppend, EventOut
from app.modules.eventstore.service import ConcurrencyError, append_event
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(require_permission(Permission.EVENTSTORE_READ))])


def _to_event_out(ev: Any) -> EventOut:
    """
    Bullet-proof mapper:
    - Avoids SQLAlchemy __dict__ (contains _sa_instance_state).
    - Handles our reserved-name workaround: model attribute is `event_metadata`,
      but API schema field is `metadata`.
    - Falls back gracefully if older/alternate attribute names exist.
    """
    # Prefer the model attribute name
    meta = getattr(ev, "event_metadata", None)
    if meta is None:
        # Fallbacks (in case of older model versions)
        meta = getattr(ev, "metadata", None)

    return EventOut(
        id=getattr(ev, "id", None),
        tenant_id=getattr(ev, "tenant_id", None),
        stream_type=getattr(ev, "stream_type", None),
        stream_id=getattr(ev, "stream_id", None),
        version=getattr(ev, "version", None),
        event_type=getattr(ev, "event_type", None),
        occurred_at=getattr(ev, "occurred_at", None),
        recorded_at=getattr(ev, "recorded_at", None),
        actor_id=getattr(ev, "actor_id", None),
        correlation_id=getattr(ev, "correlation_id", None),
        causation_id=getattr(ev, "causation_id", None),
        payload=getattr(ev, "payload", None),
        metadata=meta,
    )


@router.post("", response_model=EventOut)
def append(payload: EventAppend,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.EVENTSTORE_WRITE)),
    _idmp=Depends(idempotency_guard),):
    try:
        with uow as db:
            ev = append_event(
                db=db,
                tenant_id=tenant_id,
                stream_type=payload.stream_type,
                stream_id=payload.stream_id,
                event_type=payload.event_type,
                payload=payload.payload,
                actor_id=getattr(user, "id", None),
                correlation_id=payload.correlation_id,
                causation_id=payload.causation_id,
                occurred_at=payload.occurred_at,
                expected_version=payload.expected_version,
                metadata=payload.metadata,
            )
            return _to_event_out(ev)
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception:
        logger.exception("Failed to append event")
        raise


@router.get("", response_model=PageResult[EventOut])
def list_stream_events(
    stream_type: str = Query(...),
    stream_id: str = Query(...),
    q: str | None = Query(default=None, description="Optional filter by event_type"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    # Canonical SQL-backed paging: no full-stream load + slicing
    qry = (
        db.query(Event)
        .filter(
            Event.tenant_id == tenant_id,
            Event.stream_type == stream_type,
            Event.stream_id == stream_id,
        )
    )
    if q and q.strip():
        qry = qry.filter(Event.event_type.ilike(f"%{q.strip()}%"))

    if sort.fields:
        qry = apply_sort(
            qry,
            Event,
            sort,
            allowed={"version", "recorded_at", "occurred_at", "event_type"},
        )
    else:
        qry = qry.order_by(Event.version.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=_to_event_out,
    )
