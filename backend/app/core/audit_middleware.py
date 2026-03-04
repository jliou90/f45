from __future__ import annotations

import logging
from collections.abc import Callable
from uuid import uuid4

from app.core.auth.jwt import decode_token_safely
from app.core.request_id import get_request_id
from app.core.uow import UnitOfWork
from app.db.session import get_session_factory
from app.modules.audit.models import AuditLog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    return token or None


class AuditMiddleware(BaseHTTPMiddleware):
    """Writes an audit log record after each request.

    This is intentionally "best-effort": audit failures should never break API responses.
    """

    def __init__(self, app, *, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        if not self.enabled:
            return response

        try:
            # Tenant context is set by tenancy dependency; if absent, we still log, but tenant_id = None.
            tenant_id = request.headers.get("X-Tenant-Id") or getattr(request.state, "tenant_id", None)

            # Actor: read sub from access token (best-effort; no DB lookup in middleware).
            actor_id = getattr(request.state, "user_id", None)
            if not actor_id:
                token = _extract_bearer_token(request)
                if token:
                    payload = decode_token_safely(token)
                    if payload and payload.get("type") != "refresh":
                        actor_id = payload.get("sub")

            audit_tag = getattr(request.state, "audit_tag", None)

            # Heuristic action: allow modules to set request.state.audit_action explicitly.
            action = getattr(request.state, "audit_action", None) or getattr(audit_tag, "action", None)
            entity_type = getattr(request.state, "audit_entity_type", None) or getattr(audit_tag, "entity", None)
            entity_id = getattr(request.state, "audit_entity_id", None) or getattr(audit_tag, "entity_id", None)
            correlation_id = getattr(request.state, "audit_correlation_id", None) or getattr(request.state, "correlation_id", None)

            # Don't spam audits for health checks.
            if request.url.path in ("/health", "/healthz", "/readyz"):
                return response

            with UnitOfWork(get_session_factory()) as db:
                rec = AuditLog(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    actor_user_id=actor_id,
                    request_id=get_request_id(),
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    correlation_id=correlation_id,
                )
                db.add(rec)

        except Exception:
            logger.exception("Audit middleware failed")

        return response
