from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ROCreate(BaseModel):
    ro_id: str = Field(..., description="Client-generated UUID")
    customer_name: str | None = None
    vehicle: str | None = None


class ROEventAppend(BaseModel):
    event_type: str = Field(..., description="e.g. ro.parts_requested")
    payload: dict = Field(default_factory=dict)


class RODocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    doc_type: str
    doc_id: str
    version: int
    updated_at: datetime | None = None
    document: dict
    allowed_actions: list[str] = Field(default_factory=list)


class ROQueueItem(BaseModel):
    ro_id: str
    status: str | None = None
    customer_name: str | None = None
    vehicle: str | None = None
    parts_requested: int = 0
    updated_at: datetime | None = None
