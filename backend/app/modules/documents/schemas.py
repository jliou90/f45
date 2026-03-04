from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    doc_id: str | None = Field(default=None, description="Optional client-supplied UUID (36 char). If omitted, server generates one.")
    data: dict[str, Any] = Field(default_factory=dict, description="Arbitrary JSON document payload.")


class DocumentUpdate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict, description="Partial update (merged into existing document).")
    replace: bool = Field(default=False, description="If true, replace entire document instead of merge.")


class DocumentOut(BaseModel):
    doc_type: str
    doc_id: str
    version: int
    document: dict[str, Any]


class AttachmentOut(BaseModel):
    id: str
    tenant_id: str
    filename: str
    mime_type: str
    size: int
    sha256: str
    created_at: datetime
    created_by: str | None = None


class AttachmentLinkCreate(BaseModel):
    entity_type: str = Field(min_length=1, max_length=64)
    entity_id: str = Field(min_length=1, max_length=64)


class AttachmentLinkOut(BaseModel):
    id: str
    tenant_id: str
    attachment_id: str
    entity_type: str
    entity_id: str
    created_at: datetime
    created_by: str | None = None
