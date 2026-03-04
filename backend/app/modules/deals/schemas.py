from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DealCreate(BaseModel):
    deal_id: str = Field(..., description="Client-generated UUID")
    customer_id: str | None = None
    vehicle_id: str | None = None
    quote_amount_cents: int = 0


class DealTransition(BaseModel):
    to_state: str = Field(..., description="quote|penciled|contracted|delivered|funded|booked|unwound")
    reason: str | None = None
    payload: dict = Field(default_factory=dict)


class DealDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    doc_type: str
    doc_id: str
    version: int
    updated_at: datetime | None = None
    document: dict
    allowed_actions: list[str] = Field(default_factory=list)


class DealQueueItem(BaseModel):
    deal_id: str
    state: str
    customer_id: str | None = None
    vehicle_id: str | None = None
    updated_at: datetime | None = None
