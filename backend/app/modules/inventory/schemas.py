from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InventoryUnitCreate(BaseModel):
    unit_id: str = Field(..., description="Client-generated UUID")
    vehicle_id: str | None = None
    vin: str | None = None
    acquired_cost_cents: int = 0


class ReconItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    cost_cents: int = Field(ge=0)
    notes: str | None = None


class InventoryTransition(BaseModel):
    to_state: str = Field(..., description="acquired|recon|frontline|sold|unwound")
    reason: str | None = None
    payload: dict = Field(default_factory=dict)


class InventoryDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    doc_type: str
    doc_id: str
    version: int
    updated_at: datetime | None = None
    document: dict
    allowed_actions: list[str] = Field(default_factory=list)


class InventoryQueueItem(BaseModel):
    unit_id: str
    state: str
    total_recon_cents: int
    updated_at: datetime | None = None


class SupplyItemCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=255)
    on_hand_qty: int = Field(default=0, ge=0)
    reorder_point: int = Field(default=0, ge=0)
    reorder_qty: int = Field(default=0, ge=0)
    unit: str = Field(default="each", min_length=1, max_length=20)
    vendor: str | None = Field(default=None, max_length=255)


class SupplyItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    on_hand_qty: int | None = Field(default=None, ge=0)
    reorder_point: int | None = Field(default=None, ge=0)
    reorder_qty: int | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    vendor: str | None = Field(default=None, max_length=255)


class SupplyItemOut(BaseModel):
    id: str
    sku: str
    name: str
    on_hand_qty: int
    reorder_point: int
    reorder_qty: int
    unit: str
    vendor: str | None = None
    low_stock: bool
    created_at: datetime
    updated_at: datetime


class OrderBatchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class OrderBatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=20)
    notes: str | None = None


class OrderBatchLineUpsert(BaseModel):
    supply_item_id: str
    qty: int = Field(ge=1)


class OrderBatchLineOut(BaseModel):
    id: str
    supply_item_id: str
    supply_sku: str
    supply_name: str
    qty: int
    created_at: datetime
    updated_at: datetime


class OrderBatchOut(BaseModel):
    id: str
    name: str
    status: str
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[OrderBatchLineOut] = Field(default_factory=list)
