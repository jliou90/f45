from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SendCustomerEmailIn(BaseModel):
    to_email: EmailStr
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    attachment_id: str | None = None


class SendLenderStipIn(BaseModel):
    lender_email: EmailStr
    stip_name: str = Field(min_length=1, max_length=255)
    subject: str | None = Field(default=None, max_length=500)
    note: str | None = None
    attachment_id: str


class OutboundCommunicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    entity_type: str
    entity_id: str
    customer_id: str | None = None
    deal_id: str | None = None
    channel: str
    to_address: str
    subject: str
    body: str
    status: str
    provider_message_id: str | None = None
    error: str | None = None
    attachment_id: str | None = None
    metadata_json: dict
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
