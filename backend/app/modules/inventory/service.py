from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.core.errors import AppError
from app.modules.accounting.models import AcctPostingBatch
from app.modules.documents.models import Document
from app.modules.eventstore.service import append_event, load_stream_events
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from app.modules.inventory.projection import project_inventory_unit
from sqlalchemy.orm import Session

DOC_TYPE = "inventory_unit"
STREAM_TYPE = "inventory"

INVENTORY_STATES = ("acquired", "recon", "frontline", "sold", "unwound")
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "acquired": {"recon"},
    "recon": {"frontline"},
    "frontline": {"sold"},
    "sold": {"unwound"},
    "unwound": set(),
}


def allowed_actions_for_state(state: str | None) -> list[str]:
    current = (state or "acquired").strip().lower()
    return sorted(ALLOWED_TRANSITIONS.get(current, set()))


def _upsert_document(*, db: Session, tenant_id: str, unit_id: str, version: int, document: dict) -> Document:
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == unit_id)
        .one_or_none()
    )
    if doc is None:
        doc = Document(tenant_id=tenant_id, doc_type=DOC_TYPE, doc_id=unit_id, version=0, document={})
        db.add(doc)
        db.flush()
    doc.document = document
    doc.version = version
    doc.updated_at = datetime.now(UTC)
    db.flush()
    return doc


def rebuild_inventory_unit(*, db: Session, tenant_id: str, unit_id: str) -> Document:
    events = load_stream_events(db, tenant_id, STREAM_TYPE, unit_id)
    body = project_inventory_unit(events)
    version = events[-1].version if events else 0
    return _upsert_document(db=db, tenant_id=tenant_id, unit_id=unit_id, version=version, document=body)


def get_inventory_doc(*, db: Session, tenant_id: str, unit_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == unit_id)
        .one_or_none()
    )


def _ensure_transition(current: str, to_state: str) -> None:
    if current not in INVENTORY_STATES or to_state not in INVENTORY_STATES:
        raise AppError(code="inventory_state_invalid", message="Unknown inventory state", status_code=400)
    if to_state not in ALLOWED_TRANSITIONS.get(current, set()):
        raise AppError(
            code="inventory_transition_invalid",
            message=f"Transition {current} -> {to_state} is not allowed",
            status_code=409,
        )


def create_unit(
    *,
    db: Session,
    tenant_id: str,
    actor: User,
    unit_id: str,
    vehicle_id: str | None,
    vin: str | None,
    acquired_cost_cents: int,
) -> Document:
    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=unit_id,
        event_type="inventory.acquired",
        payload={
            "unit_id": unit_id,
            "vehicle_id": vehicle_id,
            "vin": vin,
            "acquired_cost_cents": int(acquired_cost_cents or 0),
            "state": "acquired",
        },
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="inventory.acquired", payload={"unit_id": unit_id})
    return rebuild_inventory_unit(db=db, tenant_id=tenant_id, unit_id=unit_id)


def add_recon_item(*, db: Session, tenant_id: str, actor: User, unit_id: str, name: str, cost_cents: int, notes: str | None) -> Document:
    doc = get_inventory_doc(db=db, tenant_id=tenant_id, unit_id=unit_id)
    if doc is None:
        raise AppError(code="inventory_not_found", message="Inventory unit not found", status_code=404)
    state = ((doc.document or {}).get("state") or "acquired").strip().lower()
    if state not in {"acquired", "recon", "frontline"}:
        raise AppError(code="inventory_locked", message="Cannot add recon costs in current state", status_code=409)

    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=unit_id,
        event_type="inventory.recon_item_added",
        payload={"name": name, "cost_cents": int(cost_cents), "notes": notes},
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="inventory.recon_item_added", payload={"unit_id": unit_id, "cost_cents": int(cost_cents)})
    return rebuild_inventory_unit(db=db, tenant_id=tenant_id, unit_id=unit_id)


def transition_unit(
    *,
    db: Session,
    tenant_id: str,
    actor: User,
    unit_id: str,
    to_state: str,
    reason: str | None,
    payload: dict,
) -> Document:
    doc = get_inventory_doc(db=db, tenant_id=tenant_id, unit_id=unit_id)
    if doc is None:
        raise AppError(code="inventory_not_found", message="Inventory unit not found", status_code=404)

    current = ((doc.document or {}).get("state") or "acquired").strip().lower()
    to_state = (to_state or "").strip().lower()
    _ensure_transition(current, to_state)

    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=unit_id,
        event_type="inventory.transitioned",
        payload={"from_state": current, "to_state": to_state, "reason": reason, "payload": payload or {}},
        actor_id=actor.id,
    )

    if to_state == "sold":
        existing_batch = (
            db.query(AcctPostingBatch)
            .filter(
                AcctPostingBatch.tenant_id == tenant_id,
                AcctPostingBatch.doc_type == "INVENTORY_SOLD",
                AcctPostingBatch.doc_id == unit_id,
            )
            .one_or_none()
        )
        if existing_batch is None:
            db.add(
                AcctPostingBatch(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    source_module="INVENTORY",
                    doc_type="INVENTORY_SOLD",
                    doc_id=unit_id,
                    status="DRAFT",
                    memo="Inventory sold accounting hook",
                    payload={"unit_id": unit_id, "hook": "sold"},
                    created_by_user_id=actor.id,
                )
            )
        enqueue_outbox(db=db, tenant_id=tenant_id, topic="inventory.sold", payload={"unit_id": unit_id})
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="inventory.transitioned", payload={"unit_id": unit_id, "to_state": to_state})
    return rebuild_inventory_unit(db=db, tenant_id=tenant_id, unit_id=unit_id)
