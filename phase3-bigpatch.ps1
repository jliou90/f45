param(
  [string]$RepoRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom([string]$Path, [string]$Content) {
  $dir = Split-Path -Parent $Path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Ensure-LineInFile([string]$Path, [string]$Line) {
  if (!(Test-Path $Path)) { throw "Missing file: $Path" }
  $txt = Get-Content $Path -Raw
  if ($txt -notmatch [regex]::Escape($Line)) {
    Add-Content -Path $Path -Value $Line
  }
}

Write-Host "== KUTM Phase 3 Big Patch =="

$backend = Join-Path $RepoRoot "backend"
$app = Join-Path $backend "app"
$migrations = Join-Path $backend "migrations"
$versions = Join-Path $migrations "versions"

if (!(Test-Path $backend)) { throw "Expected backend folder at $backend" }
if (!(Test-Path $app)) { throw "Expected app folder at $app" }

# ---------------------------
# 0) Ensure logs folder exists
# ---------------------------
$logs = Join-Path $backend "logs"
if (!(Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }

# ---------------------------
# 1) Router fix: migrate to app/router/api.py
#    This avoids the old error: Expected router file not found ...\app\router\api.py
# ---------------------------
$legacyRouter = Join-Path $app "router.py"
$legacyRouterNew = Join-Path $app "router_legacy.py"
$routerPkg = Join-Path $app "router"
$routerInit = Join-Path $routerPkg "__init__.py"
$routerApi = Join-Path $routerPkg "api.py"

if (Test-Path $legacyRouter) {
  Write-Host "Renaming router.py -> router_legacy.py"
  Copy-Item $legacyRouter $legacyRouterNew -Force
  Remove-Item $legacyRouter -Force
}

if (!(Test-Path $routerPkg)) { New-Item -ItemType Directory -Path $routerPkg | Out-Null }

Write-FileUtf8NoBom $routerInit @'
from .api import include_routers  # noqa: F401
'@

Write-FileUtf8NoBom $routerApi @'
from __future__ import annotations

from fastapi import APIRouter, FastAPI

from app.modules.health.api import router as health_router
from app.modules.identity.api import router as identity_router
from app.modules.tenancy.api import router as tenancy_router
from app.modules.rbac.api import router as rbac_router
from app.modules.audit.api import router as audit_router
from app.modules.dms.api import router as dms_router

# New capabilities
from app.modules.eventstore.api import router as eventstore_router
from app.modules.documents.api import router as documents_router
from app.modules.io.api import router as io_router
from app.modules.selfheal.api import router as selfheal_router

api_router = APIRouter()

# Health first
api_router.include_router(health_router)

# Foundation modules
api_router.include_router(identity_router)
api_router.include_router(tenancy_router)
api_router.include_router(rbac_router)
api_router.include_router(audit_router)

# Existing DMS (relational CRUD)
api_router.include_router(dms_router)

# Event-sourced backbone + doc store + import/export + self-heal
api_router.include_router(eventstore_router, prefix="/events", tags=["Event Store"])
api_router.include_router(documents_router, prefix="/docs", tags=["Documents"])
api_router.include_router(io_router, prefix="/io", tags=["Import/Export"])
api_router.include_router(selfheal_router, prefix="/selfheal", tags=["Self-Heal"])


def include_routers(app: FastAPI) -> None:
    app.include_router(api_router)
'@

# ---------------------------
# 2) Logging to simple txt file: backend/logs/errors.txt
# ---------------------------
$coreLogging = Join-Path $app "core\logging.py"
Write-FileUtf8NoBom $coreLogging @'
from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler


def init_file_logging(log_dir: str = "logs", error_filename: str = "errors.txt") -> None:
    """Initialize simple file logging.
    - Writes ERROR+ to logs/errors.txt
    - Writes INFO+ to logs/app.txt (rotated)
    """
    os.makedirs(log_dir, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")

    err_path = os.path.join(log_dir, error_filename)
    err_handler = RotatingFileHandler(err_path, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
    err_handler.setLevel(logging.ERROR)
    err_handler.setFormatter(fmt)

    app_path = os.path.join(log_dir, "app.txt")
    app_handler = RotatingFileHandler(app_path, maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    app_handler.setLevel(logging.INFO)
    app_handler.setFormatter(fmt)

    root.addHandler(app_handler)
    root.addHandler(err_handler)
'@

# Patch app/main.py to initialize logging and a catch-all exception handler
$mainPy = Join-Path $app "main.py"
Write-FileUtf8NoBom $mainPy @'
from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.logging import init_file_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.audit import AuditMiddleware
from app.router import include_routers

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    # Logging first (writes to ./logs/errors.txt)
    init_file_logging()

    app = FastAPI(title="King Under The Mountain - API")

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(AuditMiddleware)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request.headers.get("X-Request-ID")},
        )

    include_routers(app)
    return app


app = create_app()
'@

# ---------------------------
# 3) Event Store + Documents + Import/Export + Self-Heal modules
# ---------------------------
$modulesDir = Join-Path $app "modules"

# eventstore
Write-FileUtf8NoBom (Join-Path $modulesDir "eventstore\__init__.py") ""

Write-FileUtf8NoBom (Join-Path $modulesDir "eventstore\models.py") @'
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Stream(Base):
    __tablename__ = "streams"
    __table_args__ = {"schema": "events"}

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), nullable=False, index=True)

    stream_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    stream_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)

    current_version: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"))


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "stream_type", "stream_id", "version", name="ux_events_stream_version"),
        sa.Index("ix_events_type_time", "tenant_id", "event_type", "occurred_at"),
        sa.Index("ix_events_stream_time", "tenant_id", "stream_type", "occurred_at"),
        {"schema": "events"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), nullable=False, index=True)

    stream_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    stream_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    event_type: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    occurred_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    recorded_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"))

    actor_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)
    causation_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "eventstore\schemas.py") @'
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EventAppend(BaseModel):
    stream_type: str
    stream_id: str
    event_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    occurred_at: Optional[datetime] = None
    expected_version: Optional[int] = None
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: str
    tenant_id: str
    stream_type: str
    stream_id: str
    version: int
    event_type: str
    occurred_at: datetime
    recorded_at: datetime
    actor_id: Optional[str] = None
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    payload: Dict[str, Any]
    metadata: Dict[str, Any]
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "eventstore\service.py") @'
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.modules.eventstore.models import Stream, Event

logger = logging.getLogger(__name__)


class ConcurrencyError(RuntimeError):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
        metadata=metadata,
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
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "eventstore\api.py") @'
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.tenancy.deps import get_tenant_id
from app.modules.identity.api import get_current_user
from app.modules.eventstore.schemas import EventAppend, EventOut
from app.modules.eventstore.service import append_event, load_stream_events, ConcurrencyError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=EventOut)
def append(
    payload: EventAppend,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
):
    try:
        ev = append_event(
            db=db,
            tenant_id=tenant_id,
            stream_type=payload.stream_type,
            stream_id=payload.stream_id,
            event_type=payload.event_type,
            payload=payload.payload,
            actor_id=getattr(user, "id", None),
            correlation_id=payload.correlation_id,
            causation_id=payload.causation_id,
            occurred_at=payload.occurred_at,
            expected_version=payload.expected_version,
            metadata=payload.metadata,
        )
        db.commit()
        return EventOut(**ev.__dict__)
    except ConcurrencyError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))
    except Exception:
        db.rollback()
        logger.exception("Failed to append event")
        raise


@router.get("", response_model=list[EventOut])
def list_stream_events(
    stream_type: str = Query(...),
    stream_id: str = Query(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    events = load_stream_events(db, tenant_id, stream_type, stream_id)
    return [EventOut(**e.__dict__) for e in events]
'@

# documents
Write-FileUtf8NoBom (Join-Path $modulesDir "documents\__init__.py") ""

Write-FileUtf8NoBom (Join-Path $modulesDir "documents\models.py") @'
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        sa.PrimaryKeyConstraint("tenant_id", "doc_type", "doc_id", name="pk_documents"),
        sa.Index("ix_documents_type", "tenant_id", "doc_type"),
        sa.Index("ix_documents_gin", "document", postgresql_using="gin"),
        {"schema": "readmodels"},
    )

    tenant_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)
    doc_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    doc_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)

    version: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"))
    document: Mapped[dict] = mapped_column(JSONB, nullable=False)
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "documents\schemas.py") @'
from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    doc_id: Optional[str] = Field(default=None, description="Optional client-supplied UUID (36 char). If omitted, server generates one.")
    data: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary JSON document payload.")


class DocumentUpdate(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict, description="Partial update (merged into existing document).")
    replace: bool = Field(default=False, description="If true, replace entire document instead of merge.")
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "documents\service.py") @'
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.modules.documents.models import Document
from app.modules.eventstore.models import Event

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
'@

Write-FileUtf8NoBom (Join-Path $modulesDir "documents\api.py") @'
from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.tenancy.deps import get_tenant_id
from app.modules.identity.api import get_current_user
from app.modules.documents.schemas import DocumentCreate, DocumentUpdate
from app.modules.documents.models import Document
from app.modules.documents.service import apply_event_to_document, rebuild_document_from_events
from app.modules.eventstore.service import append_event, load_stream_events

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{doc_type}")
def create_document(
    doc_type: str,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
):
    doc_id = payload.doc_id or str(uuid4())
    event_type = f"{doc_type.title().replace('_','')}Created"

    try:
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
        db.commit()
        return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}
    except Exception:
        db.rollback()
        logger.exception("Create document failed")
        raise


@router.put("/{doc_type}/{doc_id}")
def update_document(
    doc_type: str,
    doc_id: str,
    payload: DocumentUpdate,
    expected_version: int | None = Query(default=None, description="Optional optimistic concurrency (stream expected_version)."),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
):
    existing = (
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type, Document.doc_id == doc_id)
        .one_or_none()
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Document not found")

    event_type = f"{doc_type.title().replace('_','')}Updated"
    try:
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
        db.commit()
        return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}
    except Exception:
        db.rollback()
        logger.exception("Update document failed")
        raise


@router.get("/{doc_type}/{doc_id}")
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
    return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}


@router.get("/{doc_type}")
def list_documents(
    doc_type: str,
    q: str | None = Query(default=None, description="Simple text search across JSON (ILIKE on serialized JSON)."),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == doc_type)
    if q:
        qry = qry.filter(Document.document.cast(str).ilike(f"%{q}%"))
    rows = qry.order_by(Document.updated_at.desc()).offset(offset).limit(limit).all()
    return [{"doc_id": r.doc_id, "version": r.version, "document": r.document} for r in rows]


@router.post("/{doc_type}/{doc_id}/rebuild")
def rebuild_document(
    doc_type: str,
    doc_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    events = load_stream_events(db, tenant_id, doc_type, doc_id)
    if not events:
        raise HTTPException(status_code=404, detail="No events for stream")
    doc = rebuild_document_from_events(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, events=events)
    db.commit()
    return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}
'@

# io
Write-FileUtf8NoBom (Join-Path $modulesDir "io\__init__.py") ""

Write-FileUtf8NoBom (Join-Path $modulesDir "io\api.py") @'
from __future__ import annotations

import csv
import io
import json
import logging
from typing import List
from uuid import uuid4
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.tenancy.deps import get_tenant_id
from app.modules.identity.api import get_current_user
from app.modules.documents.models import Document
from app.modules.eventstore.service import append_event
from app.modules.documents.service import apply_event_to_document

logger = logging.getLogger(__name__)

router = APIRouter()


def _flatten(doc: dict) -> dict:
    return dict(doc or {})


def _to_csv(rows: List[dict]) -> bytes:
    cols = []
    seen = set()
    for r in rows:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                cols.append(k)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue().encode("utf-8")


def _to_xml(doc_type: str, rows: List[dict]) -> bytes:
    root = ET.Element("items", attrib={"type": doc_type})
    for r in rows:
        item = ET.SubElement(root, "item")
        for k, v in r.items():
            el = ET.SubElement(item, k)
            el.text = "" if v is None else str(v)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _parse_json_bytes(data: bytes) -> List[dict]:
    obj = json.loads(data.decode("utf-8"))
    if isinstance(obj, list):
        return [o if isinstance(o, dict) else {"value": o} for o in obj]
    if isinstance(obj, dict):
        if "items" in obj and isinstance(obj["items"], list):
            return [o if isinstance(o, dict) else {"value": o} for o in obj["items"]]
        return [obj]
    raise ValueError("Unsupported JSON shape")


def _parse_csv_bytes(data: bytes) -> List[dict]:
    buf = io.StringIO(data.decode("utf-8"))
    r = csv.DictReader(buf)
    return [dict(row) for row in r]


def _parse_xml_bytes(data: bytes) -> List[dict]:
    root = ET.fromstring(data.decode("utf-8"))
    items = []
    for item in root.findall(".//item"):
        d = {}
        for child in list(item):
            d[child.tag] = child.text
        items.append(d)
    return items


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
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
):
    data = await file.read()

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
    else:
        db.commit()

    return {"doc_type": doc_type, "format": fmt, "dry_run": dry_run, "created": created, "updated": updated, "skipped": skipped, "errors": errors[:50]}
'@

# selfheal
Write-FileUtf8NoBom (Join-Path $modulesDir "selfheal\__init__.py") ""

Write-FileUtf8NoBom (Join-Path $modulesDir "selfheal\api.py") @'
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.tenancy.deps import get_tenant_id
from app.modules.identity.api import get_current_user
from app.modules.eventstore.models import Stream, Event
from app.modules.documents.models import Document
from app.modules.eventstore.service import load_stream_events
from app.modules.documents.service import rebuild_document_from_events

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
def status(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    streams = db.query(Stream).filter(Stream.tenant_id == tenant_id).count()
    events = db.query(Event).filter(Event.tenant_id == tenant_id).count()
    docs = db.query(Document).filter(Document.tenant_id == tenant_id).count()
    return {"tenant_id": tenant_id, "streams": streams, "events": events, "documents": docs}


@router.post("/rebuild/{doc_type}/{doc_id}")
def rebuild_one(
    doc_type: str,
    doc_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    evs = load_stream_events(db, tenant_id, doc_type, doc_id)
    doc = rebuild_document_from_events(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, events=evs)
    db.commit()
    return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}


@router.post("/rebuild_type/{doc_type}")
def rebuild_type(
    doc_type: str,
    limit: int = Query(default=1000, ge=1, le=5000),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    streams = (
        db.query(Stream)
        .filter(Stream.tenant_id == tenant_id, Stream.stream_type == doc_type)
        .order_by(Stream.created_at.desc())
        .limit(limit)
        .all()
    )
    rebuilt = 0
    for s in streams:
        evs = load_stream_events(db, tenant_id, doc_type, s.stream_id)
        rebuild_document_from_events(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=s.stream_id, events=evs)
        rebuilt += 1
    db.commit()
    return {"doc_type": doc_type, "rebuilt": rebuilt}
'@

# ---------------------------
# 4) Update Alembic metadata imports
# ---------------------------
$metadata = Join-Path $app "db\metadata.py"
Write-FileUtf8NoBom $metadata @'
from app.db.base import Base

# Import models so Alembic sees them (DO NOT remove)
from app.modules.identity.models import User  # noqa: F401
from app.modules.tenancy.models import Tenant  # noqa: F401

from app.modules.dms.models import Customer, Vehicle, Appointment  # noqa: F401

# Event-sourcing backbone + projections
from app.modules.eventstore.models import Stream, Event  # noqa: F401
from app.modules.documents.models import Document  # noqa: F401

# Phase 2+:
# from app.modules.audit.models import AuditLog  # noqa: F401
'@

# ---------------------------
# 5) Add migration: events + readmodels schemas
# ---------------------------
$rev = "b8c2d1f0a9e1"
$mig = Join-Path $versions "${rev}_add_eventstore_documents_io.py"

Write-FileUtf8NoBom $mig @'
"""add event store + documents read model

Revision ID: b8c2d1f0a9e1
Revises: a1bf5ac0e92e
Create Date: 2026-01-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as psql

# revision identifiers, used by Alembic.
revision: str = "b8c2d1f0a9e1"
down_revision: Union[str, None] = "a1bf5ac0e92e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS events;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS readmodels;"))

    op.create_table(
        "streams",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("stream_type", sa.String(length=100), nullable=False),
        sa.Column("stream_id", sa.String(length=36), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        schema="events",
    )
    op.create_index("ux_events_streams_tenant_type_id", "streams", ["tenant_id", "stream_type", "stream_id"], unique=True, schema="events")

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("stream_type", sa.String(length=100), nullable=False),
        sa.Column("stream_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=200), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("correlation_id", sa.String(length=36), nullable=True),
        sa.Column("causation_id", sa.String(length=36), nullable=True),
        sa.Column("payload", psql.JSONB(), nullable=False),
        sa.Column("metadata", psql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        schema="events",
    )
    op.create_index(
        "ux_events_events_stream_version",
        "events",
        ["tenant_id", "stream_type", "stream_id", "version"],
        unique=True,
        schema="events",
    )
    op.create_index("ix_events_events_tenant_type_time", "events", ["tenant_id", "event_type", "occurred_at"], schema="events")
    op.create_index("ix_events_events_tenant_stream_time", "events", ["tenant_id", "stream_type", "occurred_at"], schema="events")
    op.create_index("ix_events_events_payload_gin", "events", ["payload"], postgresql_using="gin", schema="events")

    op.create_table(
        "documents",
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("doc_type", sa.String(length=100), nullable=False),
        sa.Column("doc_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("document", psql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("tenant_id", "doc_type", "doc_id", name="pk_documents"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        schema="readmodels",
    )
    op.create_index("ix_readmodels_documents_type", "documents", ["tenant_id", "doc_type"], schema="readmodels")
    op.create_index("ix_readmodels_documents_gin", "documents", ["document"], postgresql_using="gin", schema="readmodels")


def downgrade() -> None:
    op.drop_table("documents", schema="readmodels")
    op.drop_table("events", schema="events")
    op.drop_table("streams", schema="events")
    op.execute(sa.text("DROP SCHEMA IF EXISTS readmodels CASCADE;"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS events CASCADE;"))
'@

# ---------------------------
# 6) Ensure requirements include python-multipart (file uploads)
# ---------------------------
$req = Join-Path $backend "requirements.txt"
if (!(Test-Path $req)) { throw "Missing requirements.txt" }
$reqTxt = Get-Content $req -Raw
if ($reqTxt -notmatch "python-multipart") {
  Write-Host "Adding python-multipart to requirements.txt"
  $lines = Get-Content $req
  $out = New-Object System.Collections.Generic.List[string]
  $inserted = $false
  foreach ($l in $lines) {
    $out.Add($l)
    if (!$inserted -and $l -match "^fastapi==") {
      $out.Add("python-multipart==0.0.9")
      $inserted = $true
    }
  }
  if (!$inserted) { $out.Add("python-multipart==0.0.9") }
  [System.IO.File]::WriteAllLines($req, $out)
}

Write-Host "Patch files written."

# ---------------------------
# 7) Apply python deps + run migrations
# ---------------------------
Push-Location $backend

if (!(Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Host "No venv found. Creating .venv..."
  python -m venv .venv
}

. .\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "Running Alembic upgrade..."
alembic upgrade head

Write-Host "Done. Start server with:"
Write-Host "  uvicorn app.main:app --reload --port 8010"
Write-Host ""
Write-Host "New endpoints:"
Write-Host "  GET  /selfheal/status"
Write-Host "  POST /docs/{doc_type} (create)"
Write-Host "  PUT  /docs/{doc_type}/{doc_id} (update)"
Write-Host "  GET  /docs/{doc_type}/{doc_id}"
Write-Host "  GET  /io/export/{doc_type}?fmt=json|csv|xml"
Write-Host "  POST /io/import/{doc_type}?fmt=json|csv|xml (multipart file)"
Write-Host "Logs:"
Write-Host "  backend\logs\errors.txt"

Pop-Location
