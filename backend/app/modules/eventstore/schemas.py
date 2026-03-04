from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EventAppend(BaseModel):
    stream_type: str
    stream_id: str
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime | None = None
    expected_version: int | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: str
    tenant_id: str
    stream_type: str
    stream_id: str
    version: int
    event_type: str
    occurred_at: datetime
    recorded_at: datetime
    actor_id: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    payload: dict[str, Any]
    metadata: dict[str, Any]