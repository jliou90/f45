from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str | None = None
    actor_user_id: str | None = None

    request_id: str | None = None
    method: str
    path: str
    status_code: int

    action: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    correlation_id: str | None = None

    created_at: datetime


class AuditSearchParams(BaseModel):
    action: str | None = Field(default=None, description="Exact action match")
    actor_user_id: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    since: datetime | None = None
    until: datetime | None = None
    limit: int = Field(default=200, ge=1, le=1000)


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    tenant_id: str
    actor_id: str | None = None
    action: str
    entity_type: str
    entity_id: str
    ts: datetime
    request_id: str | None = None
    reason: str | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_json")
    before: dict | None = None
    after: dict | None = None
