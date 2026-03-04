from __future__ import annotations

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)

class TenantOut(BaseModel):
    id: str
    name: str

class TenantSelectIn(BaseModel):
    tenant_id: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MyTenantOut(BaseModel):
    id: str
    name: str
    role: str
