from __future__ import annotations

import csv
import io
import json
import logging
import os
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.idempotency import idempotency_guard
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.documents.models import Document
from app.modules.documents.service import apply_event_to_document
from app.modules.eventstore.service import append_event
from app.modules.tenancy.deps import get_tenant_id
from defusedxml import ElementTree as DefusedET
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_permission(Permission.IO_READ))])
MAX_IMPORT_BYTES = int(os.getenv("KUTM_IO_IMPORT_MAX_BYTES", str(5 * 1024 * 1024)))


def _flatten(doc: dict) -> dict:
    return dict(doc or {})


def _to_csv(rows: list[dict]) -> bytes:
    cols = []
    seen = set()
    for r in rows:
        for k in r:
            if k not in seen:
                seen.add(k)
                cols.append(k)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue().encode("utf-8")


def _to_xml(doc_type: str, rows: list[dict]) -> bytes:
    root = DefusedET.Element("items", attrib={"type": doc_type})
    for r in rows:
        item = DefusedET.SubElement(root, "item")
        for k, v in r.items():
            el = DefusedET.SubElement(item, k)
            el.text = "" if v is None else str(v)
    return DefusedET.tostring(root, encoding="utf-8", xml_declaration=True)


def _parse_json_bytes(data: bytes) -> list[dict]:
    obj = json.loads(data.decode("utf-8"))
    if isinstance(obj, list):
        return [o if isinstance(o, dict) else {"value": o} for o in obj]
    if isinstance(obj, dict):
        if "items" in obj and isinstance(obj["items"], list):
            return [o if isinstance(o, dict) else {"value": o} for o in obj["items"]]
        return [obj]
    raise ValueError("Unsupported JSON shape")


def _parse_csv_bytes(data: bytes) -> list[dict]:
    buf = io.StringIO(data.decode("utf-8"))
    r = csv.DictReader(buf)
    return [dict(row) for row in r]


def _parse_xml_bytes(data: bytes) -> list[dict]:
    root = DefusedET.fromstring(data.decode("utf-8"))
    items = []
    for item in root.findall(".//item"):
        d = {}
        for child in list(item):
            d[child.tag] = child.text
        items.append(d)
    return items


async def _read_upload_limited(file: UploadFile, *, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Import payload exceeds max size ({max_bytes} bytes)",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.get("/export/{doc_type}")
def export_docs(
    doc_type: str,
    fmt: str = Query(default="json", pattern="^(json|csv|xml)$"),
    limit: int = Query(default=1000, ge=1, le=20000),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    rows = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type)
        .order_by(Document.updated_at.desc())
        .limit(limit)
        .all()
    )
    payload_rows = []
    for r in rows:
        d = {"doc_id": r.doc_id, "version": r.version, **_flatten(r.document)}
        payload_rows.append(d)

    if fmt == "json":
        data = json.dumps(payload_rows, ensure_ascii=False, indent=2).encode("utf-8")
        return Response(content=data, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{doc_type}.json"'})
    if fmt == "csv":
        data = _to_csv(payload_rows)
        return Response(content=data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{doc_type}.csv"'})
    if fmt == "xml":
        data = _to_xml(doc_type, payload_rows)
        return Response(content=data, media_type="application/xml", headers={"Content-Disposition": f'attachment; filename="{doc_type}.xml"'})
    raise HTTPException(status_code=400, detail="Invalid fmt")


@router.post("/import/{doc_type}")
async def import_docs(
    doc_type: str,
    fmt: str = Query(default="json", pattern="^(json|csv|xml)$"),
    mode: str = Query(default="upsert", pattern="^(upsert|create_only)$"),
    dry_run: bool = Query(default=False),
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.IO_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    data = await _read_upload_limited(file, max_bytes=MAX_IMPORT_BYTES)

    try:
        if fmt == "json":
            rows = _parse_json_bytes(data)
        elif fmt == "csv":
            rows = _parse_csv_bytes(data)
        elif fmt == "xml":
            rows = _parse_xml_bytes(data)
        else:
            raise ValueError("Invalid fmt")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse failed: {e}")

    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    with uow as db:
        for idx, row in enumerate(rows):
            try:
                doc_id = row.get("doc_id") or row.get("id") or str(uuid4())
                clean = dict(row)
                clean.pop("doc_id", None)
                clean.pop("id", None)
                clean.pop("version", None)

                existing = (
                    db.query(Document)
                    .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
                    .one_or_none()
                )

                if existing is None:
                    if mode in ("create_only", "upsert"):
                        if not dry_run:
                            ev = append_event(
                                db=db,
                                tenant_id=tenant_id,
                                stream_type=doc_type,
                                stream_id=doc_id,
                                event_type=f"{doc_type.title().replace('_','')}Imported",
                                payload=clean,
                                actor_id=getattr(user, "id", None),
                            )
                            apply_event_to_document(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, event=ev, replace=True)
                        created += 1
                    else:
                        skipped += 1
                else:
                    if mode == "upsert":
                        if not dry_run:
                            ev = append_event(
                                db=db,
                                tenant_id=tenant_id,
                                stream_type=doc_type,
                                stream_id=doc_id,
                                event_type=f"{doc_type.title().replace('_','')}Imported",
                                payload=clean,
                                actor_id=getattr(user, "id", None),
                                expected_version=existing.version if existing.version else None,
                            )
                            apply_event_to_document(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, event=ev, replace=False)
                        updated += 1
                    else:
                        skipped += 1
            except Exception as e:
                logger.exception("Import row %s failed", idx)
                errors.append({"row": idx, "error": str(e)})
        if dry_run:
            db.rollback()

    return {"doc_type": doc_type, "format": fmt, "dry_run": dry_run, "created": created, "updated": updated, "skipped": skipped, "errors": errors[:50]}



