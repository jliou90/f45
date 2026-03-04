from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True)
class AuditTag:
    action: str
    entity: str | None = None
    entity_id: str | None = None

def set_audit(request: Request, *, action: str, entity: str | None = None, entity_id: str | None = None) -> None:
    """
    Route handlers call this to enrich audit logs.
    Middleware should read request.state.audit_tag (best-effort).
    """
    request.state.audit_tag = AuditTag(action=action, entity=entity, entity_id=entity_id)
