from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from app.core.request_id import get_request_id
from app.modules.audit.models import AuditEvent
from sqlalchemy.orm import Query, Session

_SENSITIVE_KEY_FRAGMENTS = ("password", "token", "secret", "api_key", "apikey", "auth")
logger = logging.getLogger(__name__)


def _redact_sensitive(value):
    if isinstance(value, dict):
        out: dict = {}
        for k, v in value.items():
            key_lower = str(k).lower()
            if any(fragment in key_lower for fragment in _SENSITIVE_KEY_FRAGMENTS):
                out[k] = "***REDACTED***"
            else:
                out[k] = _redact_sensitive(v)
        return out
    if isinstance(value, list):
        return [_redact_sensitive(v) for v in value]
    return value


def log_audit_event(
    *,
    db: Session,
    tenant_id: str,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    reason: str | None = None,
    metadata: dict | None = None,
    before: dict | None = None,
    after: dict | None = None,
    request_id: str | None = None,
    actor_ip: str | None = None,
    user_agent: str | None = None,
    ts: datetime | None = None,
) -> AuditEvent | None:
    event = AuditEvent(
        id=str(uuid4()),
        tenant_id=tenant_id,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ts=ts or datetime.now(UTC),
        request_id=request_id or get_request_id(),
        actor_ip=actor_ip,
        user_agent=user_agent,
        reason=reason,
        metadata_json=_redact_sensitive(metadata or {}),
        before=_redact_sensitive(before) if before is not None else None,
        after=_redact_sensitive(after) if after is not None else None,
    )
    try:
        with db.begin_nested():
            db.add(event)
            db.flush()
    except Exception:
        logger.exception("Failed to write audit event action=%s entity=%s:%s", action, entity_type, entity_id)
        return None
    return event


def query_audit_events(
    *,
    db: Session,
    tenant_id: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_id: str | None = None,
    action: str | None = None,
    ts_from: datetime | None = None,
    ts_to: datetime | None = None,
) -> Query:
    q = db.query(AuditEvent).filter(AuditEvent.tenant_id == tenant_id)
    if entity_type:
        q = q.filter(AuditEvent.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditEvent.entity_id == entity_id)
    if actor_id:
        q = q.filter(AuditEvent.actor_id == actor_id)
    if action:
        q = q.filter(AuditEvent.action == action)
    if ts_from:
        q = q.filter(AuditEvent.ts >= ts_from)
    if ts_to:
        q = q.filter(AuditEvent.ts <= ts_to)
    return q
