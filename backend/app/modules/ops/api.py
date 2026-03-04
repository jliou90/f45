from __future__ import annotations

import os
import time
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.config import settings
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.logging import get_error_tail, get_log_tail
from app.core.observability import metrics_registry
from app.core.security import hash_password
from app.core.tenancy.deps import get_current_tenant, require_tenant_role
from app.core.uow import UnitOfWork
from app.core.version import build_info
from app.db.session import database_ready, get_db, get_uow, migrations_at_head
from app.modules.identity.models import User
from app.modules.identity.schemas import RefreshTokenCleanupOut
from app.modules.identity.service import purge_expired_and_revoked_refresh_tokens
from app.modules.rbac.service import ensure_default_admin_role
from app.modules.tenancy.models import Membership, Tenant
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

# Public ops router (bootstrap lives here)
router = APIRouter(prefix="/ops", tags=["ops"])

# Protected ops router (future ops endpoints go here)
protected = APIRouter(dependencies=[Depends(require_tenant_role("ADMIN", "OPS"))])
_STARTED_AT = time.time()


# ---------------- schemas ----------------

class BootstrapRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    tenant_name: str = Field(min_length=1, max_length=200)


class BootstrapResponse(BaseModel):
    user_id: str
    tenant_id: str
    tenant_name: str
    role: str
    hint: str


class FeatureFlagsResponse(BaseModel):
    tenant_id: str
    role: str
    flags: dict[str, bool | str | int]


class OpsLogsTailResponse(BaseModel):
    items: list[dict[str, object]]
    count: int


# ---------------- helpers ----------------

def _bootstrap_enabled() -> bool:
    """
    10-year rule:
    - Bootstrap is a *break-glass* endpoint.
    - It should be enabled only when explicitly configured.
    """
    token = (getattr(settings, "bootstrap_token", None) or "").strip()
    return bool(token)


def _require_bootstrap_token(x_bootstrap_token: str | None) -> None:
    expected = (getattr(settings, "bootstrap_token", None) or "").strip()
    if not expected:
        # Explicitly disabled unless configured
        raise AppError(
            code="bootstrap_disabled",
            message="Bootstrap is disabled (no bootstrap token configured).",
            status_code=404,
        )
    if not x_bootstrap_token or x_bootstrap_token.strip() != expected:
        raise AppError(
            code="bootstrap_forbidden",
            message="Invalid bootstrap token",
            status_code=403,
        )


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _db_check(db: Session) -> tuple[bool, float | None, str | None]:
    started = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return True, round(elapsed_ms, 2), None
    except Exception as exc:
        return False, None, str(exc)


# ---------------- endpoints ----------------

@router.post("/bootstrap", response_model=BootstrapResponse)
def bootstrap(
    payload: BootstrapRequest,
    x_bootstrap_token: str | None = Header(default=None, alias="X-Bootstrap-Token"),
    db: Session = Depends(get_db),
    _idmp=Depends(idempotency_guard),
) -> BootstrapResponse:
    """
    Dev/bootstrap: create an admin user + tenant + membership.

    Security model:
      - Requires X-Bootstrap-Token to match settings.bootstrap_token
      - NOT tenant-scoped (must work before any tenant exists)
      - NOT auth-scoped (must work before any user exists)

    Production guidance:
      - Leave settings.bootstrap_token unset => endpoint effectively disabled (404).
    """
    _require_bootstrap_token(x_bootstrap_token)

    # Normalize email
    email = payload.email.strip().lower()

    # 1) User
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None:
        user = User(
            id=str(uuid4()),
            email=email,
            display_name="Bootstrap Admin",
            password_hash=hash_password(payload.password),
            is_active=True,
            is_disabled=False,
        )
        db.add(user)
        db.flush()

    # 2) Tenant (name uniqueness is “best effort”; if you later enforce unique name per org, adjust here)
    tenant_name = payload.tenant_name.strip()
    tenant = db.query(Tenant).filter(Tenant.name == tenant_name).one_or_none()
    if tenant is None:
        tenant = Tenant(id=str(uuid4()), name=tenant_name)
        db.add(tenant)
        db.flush()

    # 3) Membership
    membership = (
        db.query(Membership)
        .filter(Membership.tenant_id == tenant.id, Membership.user_id == user.id)
        .one_or_none()
    )
    if membership is None:
        admin_role = ensure_default_admin_role(db, tenant_id=tenant.id)
        membership = Membership(tenant_id=tenant.id, user_id=user.id, role="ADMIN", role_id=admin_role.id)
        db.add(membership)
        db.flush()

    db.commit()

    return BootstrapResponse(
        user_id=user.id,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        role=membership.role,
        hint="Now login at /auth/login and send X-Tenant-Id on tenant-scoped requests.",
    )


@protected.get("/diagnostics")
def diagnostics(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user_id": current_user.id,
        "feature_flags": {
            "idempotency_enforce": os.getenv("KUTM_IDEMPOTENCY_ENFORCE", "0").strip().lower() in {"1", "true", "yes", "on"},
            "rate_limit_enabled": os.getenv("KUTM_RATE_LIMIT_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"},
        },
    }


@protected.post("/auth/cleanup-refresh-tokens", response_model=RefreshTokenCleanupOut)
def cleanup_refresh_tokens(
    _current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> RefreshTokenCleanupOut:
    with uow as db:
        result = purge_expired_and_revoked_refresh_tokens(db)
        return RefreshTokenCleanupOut(**result)


@router.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/version")
def version() -> dict[str, str | None]:
    info = build_info()
    return {
        "product_name": "KUTM",
        "version": info.get("version"),
        "git_sha": info.get("git_sha"),
    }


@router.get("/feature-flags", response_model=FeatureFlagsResponse)
def feature_flags(
    request: Request,
    _current_user: User = Depends(get_current_user),
    _tenant: Tenant = Depends(get_current_tenant),
) -> FeatureFlagsResponse:
    tenant_id = getattr(request.state, "tenant_id", "")
    role = (getattr(request.state, "tenant_role", "USER") or "USER").upper()

    flags: dict[str, bool | str | int] = {
        "commsEnabled": _env_flag("KUTM_FLAG_COMMS_ENABLED", True),
        "accountingBeta": _env_flag("KUTM_FLAG_ACCOUNTING_BETA", True),
        "realtimeEnabled": _env_flag("KUTM_FLAG_REALTIME_ENABLED", False),
        "pdfExportEnabled": _env_flag("KUTM_FLAG_PDF_EXPORT_ENABLED", True),
        "diagnosticsEnabled": _env_flag("KUTM_FLAG_DIAGNOSTICS_ENABLED", settings.runtime_env.value == "dev"),
        "scaffoldEnabled": _env_flag("KUTM_FLAG_SCAFFOLD_ENABLED", False),
        "tenantRole": role,
    }
    if role == "ADMIN":
        flags["opsFlagsDebug"] = True

    return FeatureFlagsResponse(tenant_id=tenant_id, role=role, flags=flags)


@router.get("/events", include_in_schema=False)
def events_stub() -> dict[str, str]:
    if not _env_flag("KUTM_FLAG_REALTIME_STUB_ENABLED", False):
        raise AppError(
            code="not_found",
            message="Not found",
            status_code=404,
        )
    raise AppError(
        code="not_implemented",
        message="Realtime stream endpoint is not enabled yet.",
        status_code=501,
    )


@protected.get("/diag")
def diag(current_user: User = Depends(get_current_user)) -> dict[str, object]:
    cfg = {
        "app_name": settings.app_name,
        "env": str(settings.runtime_env.value),
        "jwt_alg": settings.jwt_alg,
        "access_token_minutes": settings.access_token_minutes,
        "refresh_token_days": settings.refresh_token_days,
        "login_lockout_enabled": settings.login_lockout_enabled,
        "login_lockout_threshold": settings.login_lockout_threshold,
        "login_lockout_minutes": settings.login_lockout_minutes,
        "bootstrap_enabled": bool((settings.bootstrap_token or "").strip()) or settings.bootstrap_enabled,
        "database": {
            "host": settings.db_host,
            "port": settings.db_port,
            "name": settings.db_name,
            "user": settings.db_user,
        },
    }
    return {
        "build": build_info(),
        "config": cfg,
        "requesting_user_id": current_user.id,
    }


@protected.get("/status")
def status(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    db_ok, db_latency_ms, db_error = _db_check(db)
    ready_db_ok, ready_db_error = database_ready()
    migrations_ok, migrations = migrations_at_head()
    build = build_info()
    uptime_seconds = int(time.time() - _STARTED_AT)
    env = str(settings.runtime_env.value)

    return {
        "service": build.get("service"),
        "version": build.get("version"),
        "git_sha": build.get("git_sha"),
        "build_time": build.get("build_time"),
        "server_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "env": env,
        "uptime_seconds": uptime_seconds,
        "db": {
            "ok": db_ok and ready_db_ok,
            "latency_ms": db_latency_ms,
            "error": db_error or ready_db_error,
        },
        "migrations": {
            "ok": migrations_ok,
            "details": migrations,
        },
        "recent_errors": get_error_tail(20),
        "diagnostics_flags": {
            "diagnostics_enabled_default_dev": settings.runtime_env.value == "dev",
            "rate_limit_enabled": os.getenv("KUTM_RATE_LIMIT_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"},
            "idempotency_enforce": os.getenv("KUTM_IDEMPOTENCY_ENFORCE", "0").strip().lower() in {"1", "true", "yes", "on"},
        },
    }


@protected.get("/logs/tail", response_model=OpsLogsTailResponse)
def logs_tail(
    limit: int = 50,
    _current_user: User = Depends(get_current_user),
) -> OpsLogsTailResponse:
    items = get_log_tail(limit)
    return OpsLogsTailResponse(items=items, count=len(items))


@router.get("/metrics", include_in_schema=False)
def metrics() -> PlainTextResponse:
    return PlainTextResponse(
        content=metrics_registry.render_prometheus(),
        media_type="text/plain; version=0.0.4",
    )


# Attach protected ops routes.
router.include_router(protected)
