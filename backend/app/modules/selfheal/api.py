from __future__ import annotationsimport loggingfrom app.core.auth.deps import get_current_userfrom app.core.idempotency import idempotency_guardfrom app.core.rbac import Permission, require_permissionfrom app.core.uow import UnitOfWorkfrom app.db.session import get_db, get_uowfrom app.modules.documents.models import Documentfrom app.modules.documents.service import rebuild_document_from_eventsfrom app.modules.eventstore.models import Event, Streamfrom app.modules.eventstore.service import load_stream_eventsfrom app.modules.tenancy.deps import get_tenant_idfrom fastapi import APIRouter, Depends, Queryfrom sqlalchemy.orm import Sessionlogger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_permission(Permission.SELFHEAL_READ))])


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
def rebuild_one(doc_type: str,
    doc_id: str,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.SELFHEAL_WRITE)),
    _idmp=Depends(idempotency_guard),):
    with uow as db:
        evs = load_stream_events(db, tenant_id, doc_type, doc_id)
        doc = rebuild_document_from_events(db=db, tenant_id=tenant_id, doc_type=doc_type, doc_id=doc_id, events=evs)
        return {"doc_type": doc_type, "doc_id": doc_id, "version": doc.version, "document": doc.document}


@router.post("/rebuild_type/{doc_type}")
def rebuild_type(doc_type: str,
    limit: int = Query(default=1000, ge=1, le=5000),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.SELFHEAL_WRITE)),
    _idmp=Depends(idempotency_guard),):
    with uow as db:
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
        return {"doc_type": doc_type, "rebuilt": rebuilt}
