from __future__ import annotations

from datetime import UTC, datetime

from app.core.errors import AppError
from app.modules.documents.models import Document
from app.modules.eventstore.service import append_event, load_stream_events
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from app.modules.service_ro.projection import project_ro_summary
from sqlalchemy.orm import Session

DOC_TYPE = "ro_summary"
STREAM_TYPE = "ro"

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "open": {"ro.authorized"},
    "authorized": {"ro.started", "ro.in_progress"},
    "in_progress": {"ro.completed"},
    "complete": {"ro.closed"},
    "closed": set(),
}


def allowed_actions_for_status(status: str | None) -> list[str]:
    current = (status or "open").strip().lower()
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


def rebuild_ro_summary(*, db: Session, tenant_id: str, ro_id: str) -> Document:
    events = load_stream_events(db, tenant_id, STREAM_TYPE, ro_id)
    doc_body = project_ro_summary(events)
    version = events[-1].version if events else 0
    return _upsert_document(db=db, tenant_id=tenant_id, doc_id=ro_id, version=version, document=doc_body)


def create_ro(*, db: Session, tenant_id: str, actor: User, ro_id: str, customer_name: str | None, vehicle: str | None) -> Document:
    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=ro_id,
        event_type="ro.opened",
        payload={"ro_id": ro_id, "customer_name": customer_name, "vehicle": vehicle, "status": "open"},
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic="ro.opened", payload={"ro_id": ro_id})
    return rebuild_ro_summary(db=db, tenant_id=tenant_id, ro_id=ro_id)


def append_ro_event(*, db: Session, tenant_id: str, actor: User, ro_id: str, event_type: str, payload: dict) -> Document:
    current = get_ro_doc(db=db, tenant_id=tenant_id, ro_id=ro_id)
    if current is None:
        raise AppError(code="ro_not_found", message="RO not found", status_code=404)

    status = ((current.document or {}).get("status") or "open").strip().lower()
    payload = payload or {}

    transition_event_to_state = {
        "ro.authorized": "authorized",
        "ro.started": "in_progress",
        "ro.in_progress": "in_progress",
        "ro.completed": "complete",
        "ro.closed": "closed",
    }

    if event_type in transition_event_to_state:
        allowed = ALLOWED_TRANSITIONS.get(status, set())
        if event_type not in allowed:
            raise AppError(
                code="ro_transition_invalid",
                message=f"Transition event {event_type} is not allowed from status {status}",
                status_code=409,
            )

    if event_type == "ro.labor_line_added":
        if status == "closed":
            raise AppError(code="ro_closed_immutable", message="Cannot modify a closed RO", status_code=409)
        hours = float(payload.get("hours") or 0)
        rate = int(payload.get("rate_cents") or 0)
        total = int(payload.get("total_cents") or 0)
        if not payload.get("description") or hours <= 0 or (rate <= 0 and total <= 0):
            raise AppError(code="ro_labor_invalid", message="Labor line requires description, hours, and amount", status_code=400)

    if event_type == "ro.part_line_added":
        if status == "closed":
            raise AppError(code="ro_closed_immutable", message="Cannot modify a closed RO", status_code=409)
        qty = int(payload.get("qty") or 0)
        unit = int(payload.get("unit_cents") or 0)
        total = int(payload.get("total_cents") or 0)
        if not payload.get("part_no") or qty <= 0 or (unit <= 0 and total <= 0):
            raise AppError(code="ro_part_invalid", message="Part line requires part_no, qty, and amount", status_code=400)

    if event_type == "ro.closed":
        total_cents = int((current.document or {}).get("total_cents") or 0)
        payment_status = ((current.document or {}).get("payment_status") or "").strip().lower()
        if status != "complete":
            raise AppError(code="ro_close_precondition_failed", message="RO must be complete before close", status_code=409)
        if total_cents <= 0:
            raise AppError(code="ro_close_precondition_failed", message="RO totals must be computed before close", status_code=409)
        if payment_status not in {"paid", "warranty", "internal"}:
            raise AppError(code="ro_close_precondition_failed", message="RO payment status must be settled before close", status_code=409)

    append_event(
        db=db,
        tenant_id=tenant_id,
        stream_type=STREAM_TYPE,
        stream_id=ro_id,
        event_type=event_type,
        payload=payload,
        actor_id=actor.id,
    )
    enqueue_outbox(db=db, tenant_id=tenant_id, topic=event_type, payload={"ro_id": ro_id, **(payload or {})})
    return rebuild_ro_summary(db=db, tenant_id=tenant_id, ro_id=ro_id)


def get_ro_doc(*, db: Session, tenant_id: str, ro_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == DOC_TYPE, Document.doc_id == ro_id)
        .one_or_none()
    )
