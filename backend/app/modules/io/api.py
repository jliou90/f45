from __future__ import annotations

import csv
import io
import json
import logging
import os
import zipfile
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


def _to_xlsx(rows: list[dict]) -> bytes:
    cols: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                cols.append(key)
                seen.add(key)

    sheet_rows = [cols]
    for row in rows:
        sheet_rows.append([str(row.get(col, "")) for col in cols])

    shared_values: list[str] = []
    shared_index: dict[str, int] = {}
    for row in sheet_rows:
        for value in row:
            if value not in shared_index:
                shared_index[value] = len(shared_values)
                shared_values.append(value)

    def col_name(idx: int) -> str:
        value = idx + 1
        out = ""
        while value > 0:
            value, rem = divmod(value - 1, 26)
            out = chr(65 + rem) + out
        return out

    lines = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    lines.append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>')
    for r_idx, row in enumerate(sheet_rows, start=1):
        lines.append(f'<row r="{r_idx}">')
        for c_idx, value in enumerate(row, start=1):
            cell_ref = f"{col_name(c_idx - 1)}{r_idx}"
            lines.append(f'<c r="{cell_ref}" t="s"><v>{shared_index[value]}</v></c>')
        lines.append("</row>")
    lines.append("</sheetData></worksheet>")
    sheet_xml = "".join(lines).encode("utf-8")

    sst_lines = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    sst_lines.append(
        f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(shared_values)}" uniqueCount="{len(shared_values)}">'
    )
    for value in shared_values:
        esc = (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        sst_lines.append(f"<si><t>{esc}</t></si>")
    sst_lines.append("</sst>")
    shared_xml = "".join(sst_lines).encode("utf-8")

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ).encode("utf-8")
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        "</Relationships>"
    ).encode("utf-8")
    root_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    ).encode("utf-8")
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="1"><xf/></cellXfs>'
        "</styleSheet>"
    ).encode("utf-8")
    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        "</Types>"
    ).encode("utf-8")

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", rels_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        zf.writestr("xl/sharedStrings.xml", shared_xml)
        zf.writestr("xl/styles.xml", styles_xml)
    return out.getvalue()


def _to_pdf(*, title: str, rows: list[dict], orientation: str, scale: int) -> bytes:
    # Tiny text-only PDF generator to keep exports dependency-free.
    lines = [f"{title} ({orientation}, scale={scale}%)", ""]
    for row in rows[:200]:
        pieces = [f"{k}={row.get(k)}" for k in sorted(row.keys())]
        lines.append(" | ".join(pieces))
    y_start = 780
    y_step = 14
    content_lines = ["BT", "/F1 10 Tf"]
    y = y_start
    for line in lines:
        safe = str(line).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_lines.append(f"50 {max(20, y)} Td ({safe}) Tj")
        y -= y_step
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("utf-8")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj",
    ]
    buffer = io.BytesIO()
    buffer.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(buffer.tell())
        buffer.write(obj + b"\n")
    xref_pos = buffer.tell()
    buffer.write(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    buffer.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buffer.write(f"{off:010d} 00000 n \n".encode("ascii"))
    buffer.write(
        (
            f"trailer << /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF"
        ).encode("ascii")
    )
    return buffer.getvalue()


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
    fmt: str = Query(default="json", pattern="^(json|csv|xml|xlsx|pdf)$"),
    limit: int = Query(default=1000, ge=1, le=20000),
    orientation: str = Query(default="portrait", pattern="^(portrait|landscape)$"),
    scale: int = Query(default=100, ge=50, le=200),
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
    if fmt == "xlsx":
        data = _to_xlsx(payload_rows)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{doc_type}.xlsx"'},
        )
    if fmt == "pdf":
        data = _to_pdf(title=f"{doc_type} export", rows=payload_rows, orientation=orientation, scale=scale)
        return Response(content=data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{doc_type}.pdf"'})
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



