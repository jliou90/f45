from __future__ import annotations

from datetime import datetime

from app.core.auth.deps import get_current_user
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageMeta
from app.core.querying import Page, page_params
from app.core.rbac import Permission, require_permission
from app.core.request_id import get_request_id
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.admin import service
from app.modules.admin.schemas import (
    AuditListOut,
    BulkUsersIn,
    BulkUsersOut,
    FeatureFlagCatalogOut,
    FeatureFlagsEffectiveOut,
    FeatureOverrideDeleteOut,
    FeatureOverridesOut,
    FeatureOverrideUpsertIn,
    InviteCreateIn,
    InviteCreateOut,
    InviteRevokeOut,
    InvitesListOut,
    PasswordResetCreateOut,
    PermissionsListOut,
    RoleCreateIn,
    RoleDeleteOut,
    RoleDetailOut,
    RolesListOut,
    RoleUpdateIn,
    SessionRevokeOut,
    SessionsListOut,
    TenantLogoIn,
    TenantProfileOut,
    TenantProfileUpdateIn,
    TenantThemeOut,
    TenantThemeUpdateIn,
    UserCreateIn,
    UserDetailOut,
    UserDisableOut,
    UserRoleUpdateIn,
    UsersListOut,
    UserUpdateIn,
)
from app.modules.identity.models import User
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admin", tags=["admin"])


def _paginate(items: list[dict], page: Page) -> tuple[list[dict], PageMeta]:
    total = len(items)
    start = page.offset
    end = start + page.size
    return items[start:end], PageMeta(page=page.page, size=page.size, total=total)


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _require_admin_writable(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> None:
    service.enforce_admin_writable(db, tenant_id=tenant_id, user_id=current_user.id)


@router.get("/permissions", response_model=PermissionsListOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def list_permissions(db: Session = Depends(get_db)):
    permissions = service.list_permissions(db)
    return PermissionsListOut(items=[{"key": p.key, "description": p.description} for p in permissions], request_id=get_request_id())


@router.get("/roles", response_model=RolesListOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def list_roles(page: Page = Depends(page_params), query: str | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    items = service.list_roles(db, tenant_id=tenant_id, query=query)
    paged, meta = _paginate(items, page)
    return RolesListOut(items=paged, meta=meta, request_id=get_request_id())


@router.post(
    "/roles",
    response_model=RoleDetailOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def create_role(payload: RoleCreateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        role = service.create_role(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            name=payload.name,
            description=payload.description,
            permissions=payload.permissions,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        detail = service.get_role(db, tenant_id=tenant_id, role_id=role.id)
    return RoleDetailOut(**detail, request_id=get_request_id())


@router.get("/roles/{role_id}", response_model=RoleDetailOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def get_role(role_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    detail = service.get_role(db, tenant_id=tenant_id, role_id=role_id)
    return RoleDetailOut(**detail, request_id=get_request_id())


@router.put(
    "/roles/{role_id}",
    response_model=RoleDetailOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def update_role(role_id: str, payload: RoleUpdateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.update_role(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            role_id=role_id,
            name=payload.name,
            description=payload.description,
            permissions=payload.permissions,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        detail = service.get_role(db, tenant_id=tenant_id, role_id=role_id)
    return RoleDetailOut(**detail, request_id=get_request_id())


@router.delete(
    "/roles/{role_id}",
    response_model=RoleDeleteOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def delete_role(role_id: str, request: Request, force: bool = Query(default=False), uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.delete_role(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            role_id=role_id,
            force=force,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return RoleDeleteOut(ok=True, id=role_id, request_id=get_request_id())


@router.get("/users", response_model=UsersListOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def list_users(page: Page = Depends(page_params), query: str | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    items = service.list_users(db, tenant_id=tenant_id, query=query)
    paged, meta = _paginate(items, page)
    return UsersListOut(items=paged, meta=meta, request_id=get_request_id())


@router.post(
    "/users",
    response_model=UserDetailOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def create_user(payload: UserCreateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        user = service.create_user(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            email=str(payload.email),
            display_name=payload.display_name,
            role_id=payload.role_id,
            password=payload.password,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        detail = service.get_user_detail(db, tenant_id=tenant_id, user_id=user.id)
    return UserDetailOut(**detail, request_id=get_request_id())


@router.get("/users/{user_id}", response_model=UserDetailOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def get_user(user_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    detail = service.get_user_detail(db, tenant_id=tenant_id, user_id=user_id)
    return UserDetailOut(**detail, request_id=get_request_id())


@router.put(
    "/users/{user_id}",
    response_model=UserDetailOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def update_user(user_id: str, payload: UserUpdateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.update_user(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            user_id=user_id,
            email=str(payload.email) if payload.email is not None else None,
            display_name=payload.display_name,
            is_active=payload.is_active,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        detail = service.get_user_detail(db, tenant_id=tenant_id, user_id=user_id)
    return UserDetailOut(**detail, request_id=get_request_id())


@router.put(
    "/users/{user_id}/role",
    response_model=UserDetailOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def change_user_role(user_id: str, payload: UserRoleUpdateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.change_user_role(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            user_id=user_id,
            role_id=payload.role_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        detail = service.get_user_detail(db, tenant_id=tenant_id, user_id=user_id)
    return UserDetailOut(**detail, request_id=get_request_id())


@router.delete(
    "/users/{user_id}",
    response_model=UserDisableOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def disable_user(user_id: str, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.disable_user(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            user_id=user_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return UserDisableOut(ok=True, id=user_id, request_id=get_request_id())


@router.post(
    "/users/bulk",
    response_model=BulkUsersOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def bulk_users(payload: BulkUsersIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.bulk_users(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            action=payload.action,
            user_ids=payload.user_ids,
            role_id=payload.role_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return BulkUsersOut(**result, request_id=get_request_id())


@router.post(
    "/invites",
    response_model=InviteCreateOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def create_invite(payload: InviteCreateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.create_invite(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            email=str(payload.email),
            display_name=payload.display_name,
            role_id=payload.role_id,
            expires_in_days=payload.expires_in_days,
            base_url=_base_url(request),
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return InviteCreateOut(**result, request_id=get_request_id())


@router.get("/invites", response_model=InvitesListOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def list_invites(page: Page = Depends(page_params), query: str | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    items = service.list_invites(db, tenant_id=tenant_id, query=query)
    paged, meta = _paginate(items, page)
    return InvitesListOut(items=paged, meta=meta, request_id=get_request_id())


@router.delete(
    "/invites/{invite_id}",
    response_model=InviteRevokeOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def revoke_invite(invite_id: str, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.revoke_invite(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            invite_id=invite_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return InviteRevokeOut(ok=True, id=invite_id, request_id=get_request_id())


@router.post(
    "/users/{user_id}/password-reset",
    response_model=PasswordResetCreateOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def create_password_reset(user_id: str, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.create_password_reset(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            user_id=user_id,
            expires_in_hours=24,
            base_url=_base_url(request),
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return PasswordResetCreateOut(**result, request_id=get_request_id())


@router.get("/users/{user_id}/sessions", response_model=SessionsListOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def list_user_sessions(user_id: str, page: Page = Depends(page_params), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    items = service.list_user_sessions(db, tenant_id=tenant_id, user_id=user_id)
    paged, meta = _paginate(items, page)
    return SessionsListOut(items=paged, meta=meta, request_id=get_request_id())


@router.post(
    "/users/{user_id}/sessions/revoke",
    response_model=SessionRevokeOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def revoke_user_sessions(user_id: str, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.revoke_user_sessions(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            user_id=user_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return SessionRevokeOut(**result, request_id=get_request_id())


@router.post(
    "/sessions/revoke",
    response_model=SessionRevokeOut,
    dependencies=[Depends(require_permission(Permission.ADMIN_USERS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def revoke_session(request: Request, session_id: str = Query(...), uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.revoke_one_session(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            session_id=session_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return SessionRevokeOut(**result, request_id=get_request_id())


@router.get("/feature-flags/catalog", response_model=FeatureFlagCatalogOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def feature_flag_catalog(db: Session = Depends(get_db)):
    return FeatureFlagCatalogOut(items=service.list_feature_flag_catalog(db), request_id=get_request_id())


@router.get("/feature-flags/effective", response_model=FeatureFlagsEffectiveOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def feature_flags_effective(role_id: str | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    flags = service.resolve_effective_flags(db, tenant_id=tenant_id, user_id=current_user.id, role_id=role_id)
    return FeatureFlagsEffectiveOut(flags=flags, request_id=get_request_id())


@router.get("/feature-flags/overrides", response_model=FeatureOverridesOut, dependencies=[Depends(require_permission(Permission.ADMIN_ROLES_READ))])
def feature_flags_overrides(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    payload = service.list_feature_overrides(db, tenant_id=tenant_id)
    return FeatureOverridesOut(**payload, request_id=get_request_id())


@router.put(
    "/feature-flags/overrides/{flag_key}",
    response_model=FeatureOverrideDeleteOut,
    dependencies=[Depends(require_permission(Permission.FEATUREFLAGS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def upsert_feature_flag_override(flag_key: str, payload: FeatureOverrideUpsertIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.upsert_feature_override(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            scope=payload.scope,
            flag_key=flag_key,
            role_id=payload.role_id,
            user_id=payload.user_id,
            value=payload.value,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return FeatureOverrideDeleteOut(**result, request_id=get_request_id())


@router.delete(
    "/feature-flags/overrides/{flag_key}",
    response_model=FeatureOverrideDeleteOut,
    dependencies=[Depends(require_permission(Permission.FEATUREFLAGS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def delete_feature_flag_override(request: Request, flag_key: str, scope: str = Query(...), role_id: str | None = Query(default=None), user_id: str | None = Query(default=None), uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        result = service.delete_feature_override(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            scope=scope,
            flag_key=flag_key,
            role_id=role_id,
            user_id=user_id,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return FeatureOverrideDeleteOut(**result, request_id=get_request_id())


@router.get("/tenant/profile", response_model=TenantProfileOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def tenant_profile(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    return TenantProfileOut(**service.get_tenant_profile(db, tenant_id=tenant_id), request_id=get_request_id())


@router.put(
    "/tenant/profile",
    response_model=TenantProfileOut,
    dependencies=[Depends(require_permission(Permission.TENANT_SETTINGS_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def update_tenant_profile(payload: TenantProfileUpdateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        out = service.update_tenant_profile(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            payload=payload.model_dump(exclude_unset=True),
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return TenantProfileOut(**out, request_id=get_request_id())


@router.put(
    "/tenant/logo-url",
    response_model=TenantProfileOut,
    dependencies=[Depends(require_permission(Permission.THEME_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def set_logo_url(payload: TenantLogoIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        service.set_tenant_logo_url(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            logo_url=payload.logo_url,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        out = service.get_tenant_profile(db, tenant_id=tenant_id)
    return TenantProfileOut(**out, request_id=get_request_id())


@router.get("/tenant/theme", response_model=TenantThemeOut, dependencies=[Depends(require_permission(Permission.ADMIN_USERS_READ))])
def tenant_theme(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    return TenantThemeOut(**service.get_tenant_theme(db, tenant_id=tenant_id), request_id=get_request_id())


@router.put(
    "/tenant/theme",
    response_model=TenantThemeOut,
    dependencies=[Depends(require_permission(Permission.THEME_WRITE)), Depends(_require_admin_writable), Depends(idempotency_guard)],
)
def update_tenant_theme(payload: TenantThemeUpdateIn, request: Request, uow: UnitOfWork = Depends(get_uow), tenant_id: str = Depends(get_tenant_id), current_user: User = Depends(get_current_user)):
    with uow as db:
        out = service.update_tenant_theme(
            db,
            tenant_id=tenant_id,
            actor_user_id=current_user.id,
            theme_payload=payload.model_dump(exclude_unset=True),
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return TenantThemeOut(**out, request_id=get_request_id())


@router.get("/audit", response_model=AuditListOut, dependencies=[Depends(require_permission(Permission.ADMIN_AUDIT_READ))])
def list_audit_events(page: Page = Depends(page_params), actor: str | None = Query(default=None), action: str | None = Query(default=None), ts_from: datetime | None = Query(default=None), ts_to: datetime | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    items = service.list_audit_events(db, tenant_id=tenant_id, actor=actor, action=action, ts_from=ts_from, ts_to=ts_to)
    paged, meta = _paginate(items, page)
    return AuditListOut(items=paged, meta=meta, request_id=get_request_id())


@router.get("/audit/export", dependencies=[Depends(require_permission(Permission.ADMIN_AUDIT_READ))])
def export_audit(fmt: str = Query(default="json", pattern="^(json|csv)$"), ts_from: datetime | None = Query(default=None), ts_to: datetime | None = Query(default=None), db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    media_type, payload = service.export_audit_events(db, tenant_id=tenant_id, ts_from=ts_from, ts_to=ts_to, fmt=fmt)
    if media_type == "text/csv":
        return Response(content=payload, media_type=media_type, headers={"Content-Disposition": "attachment; filename=admin-audit.csv"})
    return JSONResponse(content=payload)
