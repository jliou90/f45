from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FundingDealCreate(BaseModel):
    deal_id: str = Field(..., description="Client-generated UUID for the deal")
    customer_name: str | None = None
    vehicle: str | None = None


class FundingEventAppend(BaseModel):
    event_type: str = Field(..., description="e.g. funding.stip_requested")
    payload: dict = Field(default_factory=dict)


class FundingDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    doc_type: str
    doc_id: str
    version: int
    updated_at: datetime | None = None
    document: dict
    allowed_actions: list[str] = Field(default_factory=list)


class FundingQueueItem(BaseModel):
    deal_id: str
    status: str | None = None
    customer_name: str | None = None
    lender: str | None = None
    stips_outstanding: int = 0
    updated_at: datetime | None = None
