from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class JobOut(BaseModel):
    id: str
    tenant_id: str
    job_type: str
    status: str
    progress: int
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
