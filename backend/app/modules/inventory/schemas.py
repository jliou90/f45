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
