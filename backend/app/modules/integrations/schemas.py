from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WebhookCreate(BaseModel):
    url: str = Field(..., max_length=1000)
    secret: str = Field(..., min_length=8, max_length=255)
    enabled: bool = True
    event_types: list[str] = Field(default_factory=list)


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    url: str
    enabled: bool
    event_types: list[str]
    created_at: datetime
    updated_at: datetime


class WebhookUpdate(BaseModel):
    url: str | None = Field(default=None, max_length=1000)
    secret: str | None = Field(default=None, min_length=8, max_length=255)
    enabled: bool | None = None
    event_types: list[str] | None = None


class OutboxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    topic: str
    payload: dict
    status: str
    attempts: int
    next_attempt_at: datetime
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime


class OutboxDrainResult(BaseModel):
    considered: int
    sent: int
    failed: int
    webhooks: int
