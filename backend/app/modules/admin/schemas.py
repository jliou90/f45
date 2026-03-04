from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from app.core.pagination import PageMeta
from pydantic import BaseModel, EmailStr, Field


class AdminPageResponse(BaseModel):
    meta: PageMeta
    request_id: str | None = None


class PermissionOut(BaseModel):
    key: str
    description: str


class PermissionsListOut(BaseModel):
    items: list[PermissionOut]
    request_id: str | None = None


class RoleSummaryOut(BaseModel):
    id: str
    name: str
    description: str | None
    permission_count: int
    memberships_count: int
    created_at: datetime
    updated_at: datetime


class RoleDetailOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: str | None
    permissions: list[str]
    memberships_count: int
    created_at: datetime
    updated_at: datetime
    request_id: str | None = None


class RolesListOut(AdminPageResponse):
    items: list[RoleSummaryOut]


class RoleCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = Field(default=None, max_length=500)
    permissions: list[str] = Field(default_factory=list)


class RoleUpdateIn(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = Field(default=None, max_length=500)
    permissions: list[str] = Field(default_factory=list)


class RoleDeleteOut(BaseModel):
    ok: bool
    id: str
    request_id: str | None = None


class UserSummaryOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    is_active: bool
    role_id: str | None
    role_name: str | None
    membership_id: str
    updated_at: datetime


class UsersListOut(AdminPageResponse):
    items: list[UserSummaryOut]


class UserDetailOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    is_active: bool
    role_id: str | None
    role_name: str | None
    membership_id: str
    membership_created_at: datetime
    membership_updated_at: datetime
    created_at: datetime
    updated_at: datetime
    request_id: str | None = None


class UserCreateIn(BaseModel):
    email: EmailStr
    display_name: str | None = Field(default=None, max_length=255)
    role_id: str
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateIn(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class UserRoleUpdateIn(BaseModel):
    role_id: str


class UserDisableOut(BaseModel):
    ok: bool
    id: str
    request_id: str | None = None


class InviteCreateIn(BaseModel):
    email: EmailStr
    display_name: str | None = Field(default=None, max_length=255)
    role_id: str
    expires_in_days: int = Field(default=7, ge=1, le=30)


class InviteCreateOut(BaseModel):
    invite_id: str
    invite_link: str | None = None
    request_id: str | None = None


class InviteOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    role_id: str
    role_name: str | None
    created_by: str | None
    created_at: datetime
    expires_at: datetime
    status: Literal["active", "expired", "revoked", "accepted"]


class InvitesListOut(AdminPageResponse):
    items: list[InviteOut]


class InviteRevokeOut(BaseModel):
    ok: bool
    id: str
    request_id: str | None = None


class AcceptInviteIn(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=255)


class PasswordResetCreateOut(BaseModel):
    ok: bool
    link: str | None = None
    request_id: str | None = None


class PasswordResetConsumeIn(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8, max_length=128)


class SessionOut(BaseModel):
    session_id: str
    created_at: datetime
    last_seen_at: datetime | None
    expires_at: datetime
    revoked_at: datetime | None
    revoked_reason: str | None
    user_agent_hash: str | None
    ip_hash: str | None
    is_active: bool


class SessionsListOut(AdminPageResponse):
    items: list[SessionOut]


class SessionRevokeOut(BaseModel):
    ok: bool
    revoked_count: int | None = None
    session_id: str | None = None
    request_id: str | None = None


class BulkUsersIn(BaseModel):
    action: Literal["disable", "set_role"]
    user_ids: list[str] = Field(min_length=1)
    role_id: str | None = None


class BulkUsersOut(BaseModel):
    action: str
    successes: list[str]
    failures: list[dict]
    request_id: str | None = None


class FeatureFlagCatalogItemOut(BaseModel):
    key: str
    description: str
    default_value: Any = None


class FeatureFlagCatalogOut(BaseModel):
    items: list[FeatureFlagCatalogItemOut]
    request_id: str | None = None


class FeatureFlagsEffectiveOut(BaseModel):
    flags: dict[str, Any]
    request_id: str | None = None


class FeatureOverridesOut(BaseModel):
    tenant: list[dict]
    role: list[dict]
    user: list[dict]
    request_id: str | None = None


class FeatureOverrideUpsertIn(BaseModel):
    scope: Literal["tenant", "role", "user"]
    role_id: str | None = None
    user_id: str | None = None
    value: Any = None


class FeatureOverrideDeleteOut(BaseModel):
    ok: bool
    deleted: int
    request_id: str | None = None


class TenantProfileOut(BaseModel):
    tenant_id: str
    display_name: str | None = None
    legal_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    logo_url: str | None = None
    theme: dict = Field(default_factory=dict)
    request_id: str | None = None


class TenantProfileUpdateIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=128)
    state: str | None = Field(default=None, max_length=64)
    postal_code: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=64)


class TenantLogoIn(BaseModel):
    logo_url: str | None = Field(default=None, max_length=1024)


class TenantThemeOut(BaseModel):
    accent_color: str = "#0b5ed7"
    logo_variant: str = "default"
    sidebar_style: str = "default"
    print_header_enabled: bool = False
    request_id: str | None = None


class TenantThemeUpdateIn(BaseModel):
    accent_color: str | None = Field(default=None, max_length=32)
    logo_variant: str | None = Field(default=None, max_length=64)
    sidebar_style: str | None = Field(default=None, max_length=64)
    print_header_enabled: bool | None = None


class AuditEventOut(BaseModel):
    id: str
    tenant_id: str
    actor_user_id: str | None
    actor_email: str | None
    action: str
    target_type: str
    target_id: str
    timestamp: datetime
    request_id: str | None
    actor_ip: str | None = None
    user_agent: str | None = None
    diff: dict | None


class AuditListOut(AdminPageResponse):
    items: list[AuditEventOut]
