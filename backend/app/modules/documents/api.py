from __future__ import annotations

import logging
import os
from hashlib import sha256
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.documents.models import Document, DocumentAttachment, DocumentAttachmentLink
from app.modules.documents.schemas import (
    AttachmentLinkCreate,
    AttachmentLinkOut,
    AttachmentOut,
    DocumentCreate,
    DocumentOut,
    DocumentUpdate,
)
from app.modules.documents.service import apply_event_to_document, rebuild_document_from_events
from app.modules.eventstore.service import append_event, load_stream_events
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
MAX_ATTACHMENT_BYTES = int(os.getenv("KUTM_ATTACHMENT_MAX_BYTES", str(10 * 1024 * 1024)))

router = APIRouter(dependencies=[Depends(require_permission(Permission.DOCUMENTS_READ))])


def _attachment_out(a: DocumentAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=a.id,
        tenant_id=a.tenant_id,
        filename=a.filename,
        mime_type=a.mime_type,
        size=int(a.size or 0),
        sha256=a.sha256,
        created_at=a.created_at,
        created_by=a.created_by,
    )


def _attachment_link_out(link: DocumentAttachmentLink) -> AttachmentLinkOut:
    return AttachmentLinkOut(
        id=link.id,
        tenant_id=link.tenant_id,
        attachment_id=link.attachment_id,
        entity_type=link.entity_type,
        entity_id=link.entity_id,
        created_at=link.created_at,
        created_by=link.created_by,
    )


@router.post("/attachments/upload", response_model=AttachmentOut)
async def upload_attachment(
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    content = await file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise AppError(
            code="attachment_too_large",
            message=f"Attachment exceeds max size ({MAX_ATTACHMENT_BYTES} bytes)",
            status_code=413,
        )

    attachment_id = str(uuid4())
    row = DocumentAttachment(
        id=attachment_id,
        tenant_id=tenant_id,
        filename=file.filename or "upload.bin",
        mime_type=file.content_type or "application/octet-stream",
        size=len(content),
        sha256=sha256(content).hexdigest(),
        content=content,
        created_by=getattr(user, "id", None),
    )
    with uow as db:
        db.add(row)
        db.flush()
        db.refresh(row)
        return _attachment_out(row)


@router.get("/attachments/{attachment_id}", response_model=AttachmentOut)
def get_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    row = (
        db.query(DocumentAttachment)
        .filter(
            DocumentAttachment.tenant_id == tenant_id,
            DocumentAttachment.id == attachment_id,
        )
        .one_or_none()
    )
    if row is None:
        raise AppError(code="attachment_not_found", message="Attachment not found", status_code=404)
    return _attachment_out(row)


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    row = (
        db.query(DocumentAttachment)
        .filter(
            DocumentAttachment.tenant_id == tenant_id,
            DocumentAttachment.id == attachment_id,
        )
        .one_or_none()
    )
    if row is None:
        raise AppError(code="attachment_not_found", message="Attachment not found", status_code=404)
    return Response(
        content=row.content,
        media_type=row.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row.filename}"'},
    )


@router.post("/attachments/{attachment_id}/links", response_model=AttachmentLinkOut)
def link_attachment(
    attachment_id: str,
    payload: AttachmentLinkCreate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        attachment = (
            db.query(DocumentAttachment)
            .filter(
                DocumentAttachment.tenant_id == tenant_id,
                DocumentAttachment.id == attachment_id,
            )
            .one_or_none()
        )
        if attachment is None:
            raise AppError(code="attachment_not_found", message="Attachment not found", status_code=404)
        link = DocumentAttachmentLink(
            id=str(uuid4()),
            tenant_id=tenant_id,
            attachment_id=attachment_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            created_by=getattr(user, "id", None),
        )
        db.add(link)
        db.flush()
        db.refresh(link)
        return _attachment_link_out(link)


@router.get("/attachments/{attachment_id}/links", response_model=PageResult[AttachmentLinkOut])
def list_attachment_links(
    attachment_id: str,
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    qry = db.query(DocumentAttachmentLink).filter(
        DocumentAttachmentLink.tenant_id == tenant_id,
        DocumentAttachmentLink.attachment_id == attachment_id,
    )
    if sort.fields:
        qry = apply_sort(
            qry,
            DocumentAttachmentLink,
            sort,
            allowed={"created_at", "entity_type", "entity_id"},
        )
    else:
        qry = qry.order_by(DocumentAttachmentLink.created_at.desc())
    return paginate_query(qry, page=page, item_map=_attachment_link_out)


@router.delete("/attachments/{attachment_id}/links/{link_id}")
def delete_attachment_link(
    attachment_id: str,
    link_id: str,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        row = (
            db.query(DocumentAttachmentLink)
            .filter(
                DocumentAttachmentLink.tenant_id == tenant_id,
                DocumentAttachmentLink.attachment_id == attachment_id,
                DocumentAttachmentLink.id == link_id,
            )
            .one_or_none()
        )
        if row is None:
            raise AppError(code="attachment_link_not_found", message="Attachment link not found", status_code=404)
        db.delete(row)
    return {"ok": True}


@router.post("/{doc_type}", response_model=DocumentOut)
def create_document(doc_type: str,
    payload: DocumentCreate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),):
    doc_id = payload.doc_id or str(uuid4())
    event_type = f"{doc_type.title().replace('_','')}Created"

    try:
        with uow as db:
            ev = append_event(
                db=db,
                tenant_id=tenant_id,
                stream_type=doc_type,
                stream_id=doc_id,
                event_type=event_type,
                payload=payload.data,
                actor_id=getattr(user, "id", None),
            )
            doc = apply_event_to_document(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, event=ev, replace=True)
            return DocumentOut(doc_type=doc_type, doc_id=doc_id, version=doc.version, document=doc.document)
    except Exception:
        logger.exception("Create document failed")
        raise


@router.put("/{doc_type}/{doc_id}", response_model=DocumentOut)
def update_document(doc_type: str,
    doc_id: str,
    payload: DocumentUpdate,
    expected_version: int | None = Query(default=None, description="Optional optimistic concurrency (stream expected_version)."),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),):
    event_type = f"{doc_type.title().replace('_','')}Updated"
    try:
        with uow as db:
            existing = (
                db.query(Document)
                .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
                .one_or_none()
            )
            if existing is None:
                raise HTTPException(status_code=404, detail="Document not found")

            ev = append_event(
                db=db,
                tenant_id=tenant_id,
                stream_type=doc_type,
                stream_id=doc_id,
                event_type=event_type,
                payload=payload.data,
                actor_id=getattr(user, "id", None),
                expected_version=expected_version,
            )
            doc = apply_event_to_document(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, event=ev, replace=payload.replace)
            return DocumentOut(doc_type=doc_type, doc_id=doc_id, version=doc.version, document=doc.document)
    except Exception:
        logger.exception("Update document failed")
        raise


@router.get("/{doc_type}/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_type: str,
    doc_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    doc = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
        .one_or_none()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut(doc_type=doc_type, doc_id=doc_id, version=doc.version, document=doc.document)


@router.get("/{doc_type}", response_model=PageResult[DocumentOut])
def list_documents(
    doc_type: str,
    q: str | None = Query(default=None, description="Simple text search across JSON (ILIKE on serialized JSON)."),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type)
    if q:
        qry = qry.filter(Document.document.cast(str).ilike(f"%{q}%"))

    if sort.fields:
        qry = apply_sort(
            qry,
            Document,
            sort,
            allowed={"doc_id", "version", "updated_at"},
        )
    else:
        qry = qry.order_by(Document.updated_at.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda r: DocumentOut(
            doc_type=doc_type,
            doc_id=r.doc_id,
            version=r.version,
            document=r.document,
        ),
    )


@router.post("/{doc_type}/{doc_id}/rebuild", response_model=DocumentOut)
def rebuild_document(doc_type: str,
    doc_id: str,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DOCUMENTS_WRITE)),
    _idmp=Depends(idempotency_guard),):
    with uow as db:
        events = load_stream_events(db, tenant_id, doc_type, doc_id)
        if not events:
            raise HTTPException(status_code=404, detail="No events for stream")
        doc = rebuild_document_from_events(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, events=events)
        return DocumentOut(doc_type=doc_type, doc_id=doc_id, version=doc.version, document=doc.document)
