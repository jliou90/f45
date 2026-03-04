from __future__ import annotations

import os
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from uuid import uuid4

from app.core.errors import AppError
from app.modules.comms.models import OutboundCommunication
from app.modules.documents.models import Document, DocumentAttachment
from app.modules.eventstore.service import append_event
from app.modules.funding.service import append_funding_event
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from sqlalchemy.orm import Session


def _smtp_configured() -> bool:
    return bool((os.getenv("SMTP_HOST") or "").strip())


def _send_smtp(*, to_address: str, subject: str, body: str, attachment: DocumentAttachment | None = None) -> str:
    host = (os.getenv("SMTP_HOST") or "").strip()
    if not host:
        return "demo-local-delivery"

    port = int(os.getenv("SMTP_PORT", "587"))
    username = (os.getenv("SMTP_USERNAME") or "").strip() or None
    password = (os.getenv("SMTP_PASSWORD") or "").strip() or None
    from_email = (os.getenv("SMTP_FROM") or "noreply@kutm.local").strip()
    use_tls = (os.getenv("SMTP_USE_TLS", "1").strip().lower() in {"1", "true", "yes", "on"})

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(body)
    if attachment is not None:
        maintype, _, subtype = (attachment.mime_type or "application/octet-stream").partition("/")
        msg.add_attachment(
            attachment.content,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=attachment.filename or "attachment.bin",
        )

    with smtplib.SMTP(host, port, timeout=8) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(msg)
    return f"smtp:{uuid4()}"


def _attachment_for_tenant(db: Session, *, tenant_id: str, attachment_id: str | None) -> DocumentAttachment | None:
    if not attachment_id:
        return None
    row = (
        db.query(DocumentAttachment)
        .filter(DocumentAttachment.tenant_id == tenant_id, DocumentAttachment.id == attachment_id)
        .one_or_none()
    )
    if row is None:
        raise AppError(code="attachment_not_found", message="Attachment not found", status_code=404)
    return row


def send_customer_email(
    *,
    db: Session,
    tenant_id: str,
    actor: User,
    customer_id: str,
    to_email: str,
    subject: str,
    body: str,
    attachment_id: str | None,
) -> OutboundCommunication:
    attachment = _attachment_for_tenant(db, tenant_id=tenant_id, attachment_id=attachment_id)
    row = OutboundCommunication(
        id=str(uuid4()),
        tenant_id=tenant_id,
        entity_type="customer",
        entity_id=customer_id,
        customer_id=customer_id,
        channel="email",
        to_address=to_email.strip().lower(),
        subject=subject.strip(),
        body=body,
        status="queued",
        attachment_id=attachment_id,
        created_by=actor.id,
        metadata_json={"smtp_configured": _smtp_configured()},
    )
    db.add(row)
    db.flush()
    try:
        provider_id = _send_smtp(
            to_address=row.to_address,
            subject=row.subject,
            body=row.body,
            attachment=attachment,
        )
        row.status = "sent"
        row.provider_message_id = provider_id
        row.updated_at = datetime.now(UTC)
        append_event(
            db=db,
            tenant_id=tenant_id,
            stream_type="customer",
            stream_id=customer_id,
            event_type="customer.contact_logged",
            payload={"channel": "email", "subject": row.subject, "to": row.to_address, "communication_id": row.id},
            actor_id=actor.id,
        )
        enqueue_outbox(
            db=db,
            tenant_id=tenant_id,
            topic="customer.email.sent",
            payload={"customer_id": customer_id, "to": row.to_address, "communication_id": row.id},
        )
    except Exception as exc:
        row.status = "failed"
        row.error = str(exc)[:2000]
        row.updated_at = datetime.now(UTC)
    db.flush()
    return row


def send_lender_stip(
    *,
    db: Session,
    tenant_id: str,
    actor: User,
    deal_id: str,
    lender_email: str,
    stip_name: str,
    subject: str | None,
    note: str | None,
    attachment_id: str,
) -> OutboundCommunication:
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == "funding_checklist", Document.doc_id == deal_id)
        .one_or_none()
    )
    if doc is None:
        raise AppError(code="funding_not_found", message="Funding deal not found", status_code=404)

    attachment = _attachment_for_tenant(db, tenant_id=tenant_id, attachment_id=attachment_id)
    subject_line = (subject or f"Requested stip: {stip_name}").strip()
    body = (note or f"Attached is the requested stip: {stip_name}").strip()

    row = OutboundCommunication(
        id=str(uuid4()),
        tenant_id=tenant_id,
        entity_type="funding_deal",
        entity_id=deal_id,
        deal_id=deal_id,
        channel="email",
        to_address=lender_email.strip().lower(),
        subject=subject_line,
        body=body,
        status="queued",
        attachment_id=attachment_id,
        created_by=actor.id,
        metadata_json={"stip_name": stip_name, "smtp_configured": _smtp_configured()},
    )
    db.add(row)
    db.flush()
    try:
        provider_id = _send_smtp(
            to_address=row.to_address,
            subject=row.subject,
            body=row.body,
            attachment=attachment,
        )
        row.status = "sent"
        row.provider_message_id = provider_id
        row.updated_at = datetime.now(UTC)
    except Exception as exc:
        row.status = "failed"
        row.error = str(exc)[:2000]
        row.updated_at = datetime.now(UTC)

    if row.status == "sent":
        append_funding_event(
            db=db,
            tenant_id=tenant_id,
            actor=actor,
            deal_id=deal_id,
            event_type="funding.sent_to_lender",
            payload={"lender_email": row.to_address, "stip_name": stip_name, "communication_id": row.id},
        )
        enqueue_outbox(
            db=db,
            tenant_id=tenant_id,
            topic="funding.stip_sent",
            payload={"deal_id": deal_id, "stip_name": stip_name, "communication_id": row.id},
        )
    db.flush()
    return row

