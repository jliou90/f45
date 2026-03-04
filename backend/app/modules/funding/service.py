from __future__ import annotations

from datetime import UTC, datetime

from app.core.errors import AppError
from app.modules.documents.models import Document
from app.modules.eventstore.service import append_event, load_stream_events
from app.modules.funding.projection import project_funding_checklist
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from sqlalchemy.orm import Session

DOC_TYPE = "funding_checklist"
STREAM_TYPE = "funding"

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "new": {"funding.deal_created"},
    "open": {"funding.stip_requested", "funding.stip_received", "funding.stip_rejected", "funding.sent_to_lender", "funding.note_added"},
    "sent": {"funding.stip_requested", "funding.stip_received", "funding.stip_rejected", "funding.funded", "funding.note_added"},
    "funded": {"funding.closed", "funding.note_added"},
    "closed": {"funding.note_added"},
}


def allowed_actions_for_status(status: str | None) -> list[str]:
    current = (status or "new").strip().lower()
    return sorted(ALLOWED_TRANSITIONS.get(current, set()))


def _upsert_document(*, db: Session, tenant_id: str, doc_id: str, version: int, document: dict) -> Document:
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == doc_id)
        .one_or_none()
    )
    if doc is None:
        doc = Document(tenant_id=tenant_id, doc_type=DOC_TYPE, doc_id=doc_id, version=0, document={})
        db.add(doc)
        db.flush()

    doc.document = document
    doc.version = version
    doc.updated_at = datetime.now(UTC)
    db.flush()
    return doc


def rebuild_funding_checklist(*, db: Session, tenant_id: str, deal_id: str) -> Document:
    events = load_stream_events(db, tenant_id, STREAM_TYPE, deal_id)
    doc_body = project_funding_checklist(events)
    version = events[-1].version if events else 0
    return _upsert_document(db=db, tenant_id=tenant_id, doc_id=deal_id, version=version, document=doc_body)


def create_deal(*, db: Session, tenant_id: str, actor: User, deal_id: str, customer_name: str | None, vehicle: str | None) -> Document:
    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=deal_id,
        event_type="funding.deal_created",
        payload={"deal_id": deal_id, "customer_name": customer_name, "vehicle": vehicle, "status": "created"},
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="funding.deal_created", payload={"deal_id": deal_id})
    return rebuild_funding_checklist(db=db, tenant_id=tenant_id, deal_id=deal_id)


def append_funding_event(*, db: Session, tenant_id: str, actor: User, deal_id: str, event_type: str, payload: dict) -> Document:
    current = get_deal_doc(db=db, tenant_id=tenant_id, deal_id=deal_id)
    status = ((current.document or {}).get("status") if current else "new") or "new"
    allowed = ALLOWED_TRANSITIONS.get(status, set())
    if event_type not in allowed:
        raise AppError(
            code="funding_invalid_transition",
            message=f"Cannot apply {event_type} while funding deal is in {status}",
            status_code=409,
        )

    if (
        event_type in {"funding.funded", "funding.closed"}
        and current is not None
        and int((current.document or {}).get("stips_outstanding") or 0) > 0
    ):
        raise AppError(
            code="funding_stips_outstanding",
            message="Cannot advance funding while required stips are outstanding",
            status_code=409,
        )

    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=deal_id,
        event_type=event_type,
        payload=payload,
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic=event_type, payload={"deal_id": deal_id, **(payload or {})})
    return rebuild_funding_checklist(db=db, tenant_id=tenant_id, deal_id=deal_id)


def get_deal_doc(*, db: Session, tenant_id: str, deal_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == deal_id)
        .one_or_none()
    )
