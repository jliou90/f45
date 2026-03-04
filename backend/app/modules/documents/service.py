from __future__ import annotations

import logging

from app.modules.documents.models import Document
from app.modules.eventstore.models import Event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def merge_dict(base: dict, patch: dict) -> dict:
    """Shallow merge (top-level). Nested dicts are replaced unless explicitly provided as merged by client."""
    out = dict(base or {})
    for k, v in (patch or {}).items():
        out[k] = v
    return out


def apply_event_to_document(
    *,
    db: Session,
    tenant_id: str,
    doc_type: str,
    doc_id: str,
    event: Event,
    replace: bool = False,
) -> Document:
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
        .one_or_none()
    )

    if doc is None:
        doc = Document(tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, version=0, document={})
        db.add(doc)
        db.flush()

    if replace or event.event_type.endswith("Created") or event.event_type.endswith("Rebuilt"):
        doc.document = event.payload
    else:
        doc.document = merge_dict(doc.document, event.payload)

    doc.version = event.version
    db.flush()
    return doc


def rebuild_document_from_events(
    *,
    db: Session,
    tenant_id: str,
    doc_type: str,
    doc_id: str,
    events: list[Event],
) -> Document:
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
        .one_or_none()
    )
    if doc is None:
        doc = Document(tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, version=0, document={})
        db.add(doc)
        db.flush()

    current = {}
    version = 0
    for ev in events:
        if ev.event_type.endswith("Created") or ev.event_type.endswith("Rebuilt") or version == 0:
            current = ev.payload
        else:
            current = merge_dict(current, ev.payload)
        version = ev.version

    doc.document = current
    doc.version = version
    db.flush()
    return doc