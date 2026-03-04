from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.core.errors import AppError
from app.modules.accounting.models import AcctPostingBatch
from app.modules.deals.projection import project_deal_summary
from app.modules.documents.models import Document
from app.modules.eventstore.service import append_event, load_stream_events
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from sqlalchemy.orm import Session

DOC_TYPE = "deal_summary"
STREAM_TYPE = "deal"

DEAL_STATES = ("quote", "penciled", "contracted", "delivered", "funded", "booked", "unwound")
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "quote": {"penciled"},
    "penciled": {"contracted"},
    "contracted": {"delivered"},
    "delivered": {"funded"},
    "funded": {"booked", "unwound"},
    "booked": {"unwound"},
    "unwound": set(),
}


def allowed_actions_for_state(state: str | None) -> list[str]:
    current = (state or "quote").strip().lower()
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


def rebuild_deal_summary(*, db: Session, tenant_id: str, deal_id: str) -> Document:
    events = load_stream_events(db, tenant_id, STREAM_TYPE, deal_id)
    doc_body = project_deal_summary(events)
    version = events[-1].version if events else 0
    return _upsert_document(db=db, tenant_id=tenant_id, doc_id=deal_id, version=version, document=doc_body)


def get_deal_doc(*, db: Session, tenant_id: str, deal_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == deal_id)
        .one_or_none()
    )


def _require_transition(current: str, to_state: str) -> None:
    if current not in DEAL_STATES or to_state not in DEAL_STATES:
        raise AppError(code="deal_state_invalid", message="Unknown deal state", status_code=400)
    if to_state not in ALLOWED_TRANSITIONS.get(current, set()):
        raise AppError(
            code="deal_transition_invalid",
            message=f"Transition {current} -> {to_state} is not allowed",
            status_code=409,
        )


def _validate_required_artifacts(*, to_state: str, payload: dict, reason: str | None) -> dict:
    required_docs: dict[str, str] = {}
    if to_state == "contracted":
        contract_id = (payload or {}).get("contract_id")
        if not contract_id:
            raise AppError(code="deal_required_missing", message="contract_id is required for contracted", status_code=400)
        required_docs["contract_id"] = str(contract_id)
    if to_state == "delivered" and not (payload or {}).get("delivery_date"):
        raise AppError(code="deal_required_missing", message="delivery_date is required for delivered", status_code=400)
    if to_state == "funded" and not (payload or {}).get("funding_reference"):
        raise AppError(code="deal_required_missing", message="funding_reference is required for funded", status_code=400)
    if to_state == "unwound" and not reason:
        raise AppError(code="deal_required_missing", message="reason is required for unwound transition", status_code=400)
    return required_docs


def create_deal(*, db: Session, tenant_id: str, actor: User, deal_id: str, customer_id: str | None, vehicle_id: str | None, quote_amount_cents: int) -> Document:
    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=deal_id,
        event_type="deal.created",
        payload={
            "deal_id": deal_id,
            "customer_id": customer_id,
            "vehicle_id": vehicle_id,
            "quote_amount_cents": int(quote_amount_cents or 0),
            "state": "quote",
        },
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="deal.created", payload={"deal_id": deal_id})
    return rebuild_deal_summary(db=db, tenant_id=tenant_id, deal_id=deal_id)


def transition_deal(
    *,
    db: Session,
    tenant_id: str,
    actor: User,
    deal_id: str,
    to_state: str,
    reason: str | None,
    payload: dict,
) -> Document:
    current_doc = get_deal_doc(db=db, tenant_id=tenant_id, deal_id=deal_id)
    if current_doc is None:
        raise AppError(code="deal_not_found", message="Deal not found", status_code=404)
    current_state = ((current_doc.document or {}).get("state") or "quote").strip().lower()
    to_state = (to_state or "").strip().lower()
    _require_transition(current_state, to_state)
    required_docs = _validate_required_artifacts(to_state=to_state, payload=payload or {}, reason=reason)

    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=deal_id,
        event_type="deal.transitioned",
        payload={
            "from_state": current_state,
            "to_state": to_state,
            "reason": reason,
            "required_docs": required_docs,
            "payload": payload or {},
        },
        actor_id=actor.id,
    )

    if to_state == "booked":
        existing_batch = (
            db.query(AcctPostingBatch)
            .filter(
                AcctPostingBatch.tenant_id == tenant_id,
                AcctPostingBatch.doc_type == "DEAL_BOOK",
                AcctPostingBatch.doc_id == deal_id,
            )
            .one_or_none()
        )
        if existing_batch is None:
            db.add(
                AcctPostingBatch(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    source_module="DEALS",
                    doc_type="DEAL_BOOK",
                    doc_id=deal_id,
                    status="DRAFT",
                    memo="Booking stub from deals workflow",
                    payload={"deal_id": deal_id, "hook": "booked"},
                    created_by_user_id=actor.id,
                )
            )
        enqueue_outbox(db=db, tenant_id=tenant_id, topic="deal.booked", payload={"deal_id": deal_id})

    enqueue_outbox(
        db=db,
        tenant_id=tenant_id,
        topic="deal.transitioned",
        payload={"deal_id": deal_id, "from_state": current_state, "to_state": to_state},
    )
    return rebuild_deal_summary(db=db, tenant_id=tenant_id, deal_id=deal_id)
