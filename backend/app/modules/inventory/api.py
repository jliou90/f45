from __future__ import annotations

from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import (
    finalize_idempotent_request,
    idempotency_guard,
    start_idempotent_request,
)
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.audit.service import log_audit_event
from app.modules.documents.models import Document
from app.modules.inventory.schemas import (
    InventoryDocOut,
    InventoryQueueItem,
    InventoryTransition,
    InventoryUnitCreate,
    OrderBatchCreate,
    OrderBatchLineOut,
    OrderBatchLineUpsert,
    OrderBatchOut,
    OrderBatchUpdate,
    ReconItemCreate,
    SupplyItemCreate,
    SupplyItemOut,
    SupplyItemUpdate,
)
from app.modules.inventory.service import (
    add_recon_item,
    allowed_actions_for_state,
    create_unit,
    get_inventory_doc,
    transition_unit,
)
from app.modules.inventory.models import (
    InventoryOrderBatch,
    InventoryOrderBatchLine,
    InventorySupplyItem,
)
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    dependencies=[Depends(get_current_user), Depends(require_permission(Permission.INVENTORY_READ))],
)


def _supply_out(row: InventorySupplyItem) -> SupplyItemOut:
    return SupplyItemOut(
        id=row.id,
        sku=row.sku,
        name=row.name,
        on_hand_qty=int(row.on_hand_qty or 0),
        reorder_point=int(row.reorder_point or 0),
        reorder_qty=int(row.reorder_qty or 0),
        unit=row.unit,
        vendor=row.vendor,
        low_stock=int(row.on_hand_qty or 0) <= int(row.reorder_point or 0),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _batch_out(db: Session, *, batch: InventoryOrderBatch, tenant_id: str) -> OrderBatchOut:
    lines = (
        db.query(InventoryOrderBatchLine, InventorySupplyItem)
        .join(
            InventorySupplyItem,
            (InventorySupplyItem.id == InventoryOrderBatchLine.supply_item_id)
            & (InventorySupplyItem.tenant_id == InventoryOrderBatchLine.tenant_id),
        )
        .filter(InventoryOrderBatchLine.tenant_id == tenant_id, InventoryOrderBatchLine.batch_id == batch.id)
        .order_by(InventorySupplyItem.name.asc())
        .all()
    )
    return OrderBatchOut(
        id=batch.id,
        name=batch.name,
        status=batch.status,
        notes=batch.notes,
        created_by=batch.created_by,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        lines=[
            OrderBatchLineOut(
                id=line.id,
                supply_item_id=line.supply_item_id,
                supply_sku=supply.sku,
                supply_name=supply.name,
                qty=int(line.qty or 0),
                created_at=line.created_at,
                updated_at=line.updated_at,
            )
            for line, supply in lines
        ],
    )


@router.post("/units", response_model=InventoryDocOut)
def create(
    payload: InventoryUnitCreate,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.INVENTORY_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="inventory.units.create",
            idempotency_key=idempotency_key,
            request_payload=payload.model_dump(mode="json"),
        )
        if idmp.replay is not None:
            return InventoryDocOut.model_validate(idmp.replay)

        request.state.audit_action = "inventory.create"
        request.state.audit_entity_type = "inventory"
        request.state.audit_entity_id = payload.unit_id
        doc = create_unit(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            unit_id=payload.unit_id,
            vehicle_id=payload.vehicle_id,
            vin=payload.vin,
            acquired_cost_cents=payload.acquired_cost_cents,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="inventory.create",
            entity_type="inventory_unit",
            entity_id=payload.unit_id,
            after={"state": (doc.document or {}).get("state")},
        )
        out = InventoryDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="inventory_doc",
            resource_id=out.doc_id,
        )
        return out


@router.post("/units/{unit_id}/recon-items", response_model=InventoryDocOut)
def add_recon(
    unit_id: str,
    payload: ReconItemCreate,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.INVENTORY_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="inventory.recon.add",
            idempotency_key=idempotency_key,
            request_payload={"unit_id": unit_id, **payload.model_dump(mode="json")},
        )
        if idmp.replay is not None:
            return InventoryDocOut.model_validate(idmp.replay)

        request.state.audit_action = "inventory.recon.add"
        request.state.audit_entity_type = "inventory"
        request.state.audit_entity_id = unit_id
        doc = add_recon_item(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            unit_id=unit_id,
            name=payload.name,
            cost_cents=payload.cost_cents,
            notes=payload.notes,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="inventory.recon.add",
            entity_type="inventory_unit",
            entity_id=unit_id,
            metadata={"cost_cents": payload.cost_cents, "name": payload.name},
            after={"total_recon_cents": (doc.document or {}).get("total_recon_cents")},
        )
        out = InventoryDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="inventory_doc",
            resource_id=out.doc_id,
        )
        return out


@router.post("/units/{unit_id}/transition", response_model=InventoryDocOut)
def transition(
    unit_id: str,
    payload: InventoryTransition,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.INVENTORY_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            endpoint_key="inventory.transition",
            idempotency_key=idempotency_key,
            request_payload={"unit_id": unit_id, **payload.model_dump(mode="json")},
        )
        if idmp.replay is not None:
            return InventoryDocOut.model_validate(idmp.replay)

        request.state.audit_action = "inventory.transition"
        request.state.audit_entity_type = "inventory"
        request.state.audit_entity_id = unit_id
        doc = transition_unit(
            db=db,
            tenant_id=tenant_id,
            actor=user,
            unit_id=unit_id,
            to_state=payload.to_state,
            reason=payload.reason,
            payload=payload.payload,
        )
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=user.id,
            action="inventory.transition",
            entity_type="inventory_unit",
            entity_id=unit_id,
            reason=payload.reason,
            metadata={"to_state": payload.to_state},
            after={"state": (doc.document or {}).get("state")},
        )
        out = InventoryDocOut.model_validate(doc)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="inventory_doc",
            resource_id=out.doc_id,
        )
        return out


@router.get("/units/{unit_id}", response_model=InventoryDocOut)
def get_one(unit_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    doc = get_inventory_doc(db=db, tenant_id=tenant_id, unit_id=unit_id)
    if doc is None:
        raise AppError(code="inventory_not_found", message="Inventory unit not found", status_code=404)
    out = InventoryDocOut.model_validate(doc)
    return out.model_copy(update={"allowed_actions": allowed_actions_for_state((doc.document or {}).get("state"))})


@router.get("/queue", response_model=PageResult[InventoryQueueItem])
def queue(
    state: str | None = None,
    q: str | None = Query(default=None, description="Optional search in inventory JSON"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(Document).filter(Document.tenant_id == tenant_id, Document.doc_type == "inventory_unit")
    if state:
        qry = qry.filter(Document.document["state"].astext == state)
    if q and q.strip():
        qry = qry.filter(Document.document.cast(str).ilike(f"%{q.strip()}%"))
    if sort.fields:
        qry = apply_sort(qry, Document, sort, allowed={"doc_id", "updated_at", "version"})
    else:
        qry = qry.order_by(Document.updated_at.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda d: InventoryQueueItem(
            unit_id=d.doc_id,
            state=(d.document or {}).get("state") or "acquired",
            total_recon_cents=int((d.document or {}).get("total_recon_cents") or 0),
            updated_at=d.updated_at,
        ),
    )


@router.get("/supplies", response_model=PageResult[SupplyItemOut], dependencies=[Depends(require_permission(Permission.INVENTORY_SUPPLIES_READ))])
def list_supplies(
    q: str | None = Query(default=None),
    low_only: bool = Query(default=False),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(InventorySupplyItem).filter(InventorySupplyItem.tenant_id == tenant_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        qry = qry.filter((InventorySupplyItem.name.ilike(like)) | (InventorySupplyItem.sku.ilike(like)))
    if low_only:
        qry = qry.filter(InventorySupplyItem.on_hand_qty <= InventorySupplyItem.reorder_point)
    if sort.fields:
        qry = apply_sort(qry, InventorySupplyItem, sort, allowed={"sku", "name", "on_hand_qty", "reorder_point", "updated_at"})
    else:
        qry = qry.order_by(InventorySupplyItem.name.asc())
    return paginate_query(qry, page=page, item_map=_supply_out)


@router.post("/supplies", response_model=SupplyItemOut, dependencies=[Depends(require_permission(Permission.INVENTORY_SUPPLIES_WRITE))])
def create_supply(
    payload: SupplyItemCreate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        row = InventorySupplyItem(
            id=str(uuid4()),
            tenant_id=tenant_id,
            sku=payload.sku.strip().upper(),
            name=payload.name.strip(),
            on_hand_qty=payload.on_hand_qty,
            reorder_point=payload.reorder_point,
            reorder_qty=payload.reorder_qty,
            unit=payload.unit.strip(),
            vendor=(payload.vendor or "").strip() or None,
        )
        db.add(row)
        db.flush()
        return _supply_out(row)


@router.patch("/supplies/{supply_id}", response_model=SupplyItemOut, dependencies=[Depends(require_permission(Permission.INVENTORY_SUPPLIES_WRITE))])
def patch_supply(
    supply_id: str,
    payload: SupplyItemUpdate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        row = (
            db.query(InventorySupplyItem)
            .filter(InventorySupplyItem.tenant_id == tenant_id, InventorySupplyItem.id == supply_id)
            .one_or_none()
        )
        if row is None:
            raise AppError(code="inventory_supply_not_found", message="Supply item not found", status_code=404)
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(row, key, value)
        db.flush()
        return _supply_out(row)


@router.post("/order-batches", response_model=OrderBatchOut, dependencies=[Depends(require_permission(Permission.INVENTORY_PROCUREMENT_WRITE))])
def create_order_batch(
    payload: OrderBatchCreate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        batch = InventoryOrderBatch(
            id=str(uuid4()),
            tenant_id=tenant_id,
            name=payload.name.strip(),
            status="draft",
            notes=payload.notes,
            created_by=user.id,
        )
        db.add(batch)
        db.flush()
        return _batch_out(db, batch=batch, tenant_id=tenant_id)


@router.get("/order-batches", response_model=PageResult[OrderBatchOut], dependencies=[Depends(require_permission(Permission.INVENTORY_PROCUREMENT_READ))])
def list_order_batches(
    status: str | None = Query(default=None),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    qry = db.query(InventoryOrderBatch).filter(InventoryOrderBatch.tenant_id == tenant_id)
    if status and status.strip():
        qry = qry.filter(InventoryOrderBatch.status == status.strip().lower())
    if sort.fields:
        qry = apply_sort(qry, InventoryOrderBatch, sort, allowed={"status", "name", "updated_at", "created_at"})
    else:
        qry = qry.order_by(InventoryOrderBatch.updated_at.desc())
    return paginate_query(qry, page=page, item_map=lambda b: _batch_out(db, batch=b, tenant_id=tenant_id))


@router.patch("/order-batches/{batch_id}", response_model=OrderBatchOut, dependencies=[Depends(require_permission(Permission.INVENTORY_PROCUREMENT_WRITE))])
def update_order_batch(
    batch_id: str,
    payload: OrderBatchUpdate,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        batch = (
            db.query(InventoryOrderBatch)
            .filter(InventoryOrderBatch.tenant_id == tenant_id, InventoryOrderBatch.id == batch_id)
            .one_or_none()
        )
        if batch is None:
            raise AppError(code="inventory_order_batch_not_found", message="Order batch not found", status_code=404)
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            if isinstance(value, str) and key == "status":
                value = value.strip().lower()
            setattr(batch, key, value)
        db.flush()
        return _batch_out(db, batch=batch, tenant_id=tenant_id)


@router.put("/order-batches/{batch_id}/lines", response_model=OrderBatchOut, dependencies=[Depends(require_permission(Permission.INVENTORY_PROCUREMENT_WRITE))])
def upsert_order_batch_line(
    batch_id: str,
    payload: OrderBatchLineUpsert,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        batch = (
            db.query(InventoryOrderBatch)
            .filter(InventoryOrderBatch.tenant_id == tenant_id, InventoryOrderBatch.id == batch_id)
            .one_or_none()
        )
        if batch is None:
            raise AppError(code="inventory_order_batch_not_found", message="Order batch not found", status_code=404)
        supply = (
            db.query(InventorySupplyItem)
            .filter(InventorySupplyItem.tenant_id == tenant_id, InventorySupplyItem.id == payload.supply_item_id)
            .one_or_none()
        )
        if supply is None:
            raise AppError(code="inventory_supply_not_found", message="Supply item not found", status_code=404)

        line = (
            db.query(InventoryOrderBatchLine)
            .filter(
                InventoryOrderBatchLine.tenant_id == tenant_id,
                InventoryOrderBatchLine.batch_id == batch_id,
                InventoryOrderBatchLine.supply_item_id == payload.supply_item_id,
            )
            .one_or_none()
        )
        if line is None:
            line = InventoryOrderBatchLine(
                id=str(uuid4()),
                tenant_id=tenant_id,
                batch_id=batch_id,
                supply_item_id=payload.supply_item_id,
                qty=payload.qty,
            )
        else:
            line.qty = payload.qty
        db.add(line)
        db.flush()
        return _batch_out(db, batch=batch, tenant_id=tenant_id)
