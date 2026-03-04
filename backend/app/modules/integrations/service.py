from __future__ import annotations

import hmac
import json
import logging
import os
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from ipaddress import ip_address
from urllib.parse import urlparse
from uuid import uuid4

import httpx
from app.core.errors import AppError
from app.modules.integrations.models import OutboxMessage, WebhookSubscription
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _allow_private_webhook_hosts() -> bool:
    raw = os.getenv("KUTM_WEBHOOK_ALLOW_PRIVATE_HOSTS", "").strip().lower()
    if not raw:
        return False
    return raw in {"1", "true", "yes", "on"}


def _validate_webhook_url(url: str) -> str:
    normalized = (url or "").strip()
    if not normalized:
        raise AppError(code="integrations_invalid_webhook_url", message="Webhook URL is required")

    parsed = urlparse(normalized)
    if parsed.scheme not in {"https", "http"}:
        raise AppError(
            code="integrations_invalid_webhook_url",
            message="Webhook URL must use http or https",
        )
    if not parsed.hostname:
        raise AppError(code="integrations_invalid_webhook_url", message="Webhook URL hostname is required")
    if parsed.username or parsed.password:
        raise AppError(
            code="integrations_invalid_webhook_url",
            message="Webhook URL must not include credentials",
        )

    host = parsed.hostname.strip().lower()
    if _allow_private_webhook_hosts():
        return normalized

    blocked_hostnames = {"localhost", "host.docker.internal", "127.0.0.1", "::1"}
    if host in blocked_hostnames or host.endswith(".local"):
        raise AppError(
            code="integrations_webhook_private_host_blocked",
            message="Webhook URL host is not allowed",
        )

    try:
        ip = ip_address(host)
    except ValueError:
        return normalized

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise AppError(
            code="integrations_webhook_private_host_blocked",
            message="Webhook URL host is not allowed",
        )
    return normalized


def list_webhooks(*, db: Session, tenant_id: str) -> list[WebhookSubscription]:
    return (
        db.query(WebhookSubscription)
        .filter(WebhookSubscription.tenant_id == tenant_id)
        .order_by(WebhookSubscription.created_at.desc())
        .all()
    )


def create_webhook(
    *,
    db: Session,
    tenant_id: str,
    url: str,
    secret: str,
    enabled: bool,
    event_types: list[str],
) -> WebhookSubscription:
    normalized_url = _validate_webhook_url(url)
    wh = WebhookSubscription(
        id=str(uuid4()),
        tenant_id=tenant_id,
        url=normalized_url,
        secret=secret,
        enabled=enabled,
        event_types=event_types or [],
    )
    db.add(wh)
    db.flush()
    return wh


def update_webhook(
    *,
    db: Session,
    tenant_id: str,
    webhook_id: str,
    url: str | None = None,
    secret: str | None = None,
    enabled: bool | None = None,
    event_types: list[str] | None = None,
) -> WebhookSubscription:
    wh = (
        db.query(WebhookSubscription)
        .filter(WebhookSubscription.tenant_id == tenant_id, WebhookSubscription.id == webhook_id)
        .one()
    )
    if url is not None:
        wh.url = _validate_webhook_url(url)
    if secret is not None:
        wh.secret = secret
    if enabled is not None:
        wh.enabled = enabled
    if event_types is not None:
        wh.event_types = event_types
    wh.updated_at = datetime.now(UTC)
    db.flush()
    return wh


def enqueue_outbox(*, db: Session, tenant_id: str, topic: str, payload: dict[str, object]) -> OutboxMessage:
    msg = OutboxMessage(
        id=str(uuid4()),
        tenant_id=tenant_id,
        topic=topic,
        payload=payload,
        status="pending",
        attempts=0,
        next_attempt_at=datetime.now(UTC),
        last_error=None,
        updated_at=datetime.now(UTC),
    )
    db.add(msg)
    db.flush()
    return msg


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, sha256).hexdigest()


def drain_outbox(
    *,
    db: Session,
    tenant_id: str,
    limit: int = 200,
    timeout_seconds: float = 5.0,
) -> dict[str, int]:
    now = datetime.now(UTC)
    query = (
        db.query(OutboxMessage)
        .filter(
            OutboxMessage.tenant_id == tenant_id,
            OutboxMessage.status.in_(["pending", "failed"]),
            OutboxMessage.next_attempt_at <= now,
        )
        .order_by(OutboxMessage.created_at.asc())
    )
    # Prevent duplicate delivery across concurrent workers/processes.
    if db.bind is not None and getattr(db.bind.dialect, "name", "") == "postgresql":
        query = query.with_for_update(skip_locked=True)
    msgs = query.limit(limit).all()

    hooks = list_webhooks(db=db, tenant_id=tenant_id)
    active_hooks = [h for h in hooks if h.enabled]

    sent = 0
    failed = 0

    with httpx.Client(timeout=timeout_seconds) as client:
        for msg in msgs:
            try:
                # Deliver to matching subscriptions
                delivered_any = False
                body = json.dumps(
                    {"topic": msg.topic, "payload": msg.payload, "id": msg.id}
                ).encode("utf-8")

                for wh in active_hooks:
                    if wh.event_types and msg.topic not in wh.event_types:
                        continue
                    signature = _sign(wh.secret, body)
                    headers = {
                        "Content-Type": "application/json",
                        "X-KUTM-Signature": signature,
                        "X-KUTM-Topic": msg.topic,
                    }
                    resp = client.post(wh.url, content=body, headers=headers)
                    resp.raise_for_status()
                    delivered_any = True

                # If no webhooks exist, treat as sent for demoability.
                msg.status = "sent" if delivered_any or not active_hooks else "pending"
                msg.attempts = msg.attempts + 1
                msg.last_error = None
                msg.updated_at = datetime.now(UTC)
                sent += 1

            except Exception as e:
                msg.status = "failed"
                msg.attempts = msg.attempts + 1
                msg.last_error = str(e)[:2000]
                # exponential-ish backoff
                delay = min(60 * 60, 2 ** min(10, msg.attempts))
                msg.next_attempt_at = datetime.now(UTC) + timedelta(seconds=delay)
                msg.updated_at = datetime.now(UTC)
                failed += 1

    db.flush()
    return {"considered": len(msgs), "sent": sent, "failed": failed, "webhooks": len(active_hooks)}
