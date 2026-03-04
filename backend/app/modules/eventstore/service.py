from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from app.modules.eventstore.models import Event, Stream
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ConcurrencyError(RuntimeError):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC)


def append_event(
    *,
    db: Session,
    tenant_id: str,
    stream_type: str,
    stream_id: str,
    event_type: str,
    payload: dict,
    actor_id: str | None = None,
    correlation_id: str | None = None,
    causation_id: str | None = None,
    occurred_at: datetime | None = None,
    expected_version: int | None = None,
    metadata: dict | None = None,
) -> Event:
    """Append an immutable event to a stream with optimistic concurrency."""
    if occurred_at is None:
        occurred_at = _utcnow()
    if metadata is None:
        metadata = {}

    stream = (
        db.query(Stream)
        .filter(Stream.tenant_id == tenant_id, Stream.stream_type == stream_type, Stream.stream_id == stream_id)
        .one_or_none()
    )
    if stream is None:
        stream = Stream(
            id=str(uuid4()),
            tenant_id=tenant_id,
            stream_type=stream_type,
            stream_id=stream_id,
            current_version=0,
        )
        db.add(stream)
        db.flush()

    if expected_version is not None and stream.current_version != expected_version:
        raise ConcurrencyError(f"Stream version mismatch: expected {expected_version}, actual {stream.current_version}")

    next_version = stream.current_version + 1

    ev = Event(
        id=str(uuid4()),
        tenant_id=tenant_id,
        stream_type=stream_type,
        stream_id=stream_id,
        version=next_version,
        event_type=event_type,
        occurred_at=occurred_at,
        actor_id=actor_id,
        correlation_id=correlation_id,
        causation_id=causation_id,
        payload=payload,
        event_metadata=metadata,
    )

    db.add(ev)
    stream.current_version = next_version
    db.flush()

    logger.info("Appended event %s v%s to %s:%s", event_type, next_version, stream_type, stream_id)
    return ev


def load_stream_events(db: Session, tenant_id: str, stream_type: str, stream_id: str) -> list[Event]:
    return (
        db.query(Event)
        .filter(Event.tenant_id == tenant_id, Event.stream_type == stream_type, Event.stream_id == stream_id)
        .order_by(Event.version.asc())
        .all()
    )