from __future__ import annotations

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.uow import UnitOfWork
from app.db.session import get_uow
from app.modules.admin import service as admin_service
from app.modules.identity.models import User
from app.modules.identity.schemas import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MfaCodeIn,
    MfaEnrollStartOut,
    MfaStatusOut,
    PasswordResetConsumeRequest,
    RefreshRequest,
    TokenPair,
)
from app.modules.identity.service import (
    authenticate,
    begin_mfa_enrollment,
    change_password,
    confirm_mfa_enrollment,
    disable_mfa,
    issue_token_pair,
    revoke_refresh_token,
    rotate_refresh_token,
)
from fastapi import APIRouter, Depends, Request

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return None


@router.post("/login", response_model=TokenPair)
def login(
    payload: LoginRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> TokenPair:
    with uow as db:
        user = authenticate(db, payload.email, payload.password, payload.otp_code)
        if not user:
            raise AppError(
                code="auth_invalid_credentials",
                message="Invalid credentials",
                status_code=401,
            )
        if user.is_disabled or not user.is_active:
            raise AppError(code="auth_user_disabled", message="User is disabled", status_code=401)

        access, refresh = issue_token_pair(
            db,
            user=user,
            user_agent=request.headers.get("User-Agent"),
            ip_address=_client_ip(request),
        )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}


@router.post("/refresh", response_model=TokenPair)
def refresh(
    payload: RefreshRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> TokenPair:
    with uow as db:
        access, refresh_token = rotate_refresh_token(
            db,
            refresh_token=payload.refresh_token,
            user_agent=request.headers.get("User-Agent"),
            ip_address=_client_ip(request),
        )
    return TokenPair(access_token=access, refresh_token=refresh_token)


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> dict[str, bool]:
    with uow as db:
        revoke_refresh_token(
            db,
            refresh_token=payload.refresh_token,
            reason="logout",
            expected_user_id=current_user.id,
            user_agent=request.headers.get("User-Agent"),
            ip_address=_client_ip(request),
        )
    return {"ok": True}


@router.post("/change-password")
def update_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> dict[str, bool]:
    if len(payload.new_password) < 8:
        raise AppError(
            code="auth_password_too_short",
            message="Password must be at least 8 characters",
            status_code=422,
        )

    with uow as db:
        user = db.get(User, current_user.id)
        if user is None:
            raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
        if user.is_disabled or not user.is_active:
            raise AppError(code="auth_user_disabled", message="User is disabled", status_code=401)

        change_password(
            db,
            user=user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    return {"ok": True}


@router.post("/accept-invite")
def accept_invite(
    payload: AcceptInviteRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> dict[str, bool]:
    with uow as db:
        admin_service.accept_invite(
            db,
            token=payload.token,
            password=payload.password,
            display_name=payload.display_name,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return {"ok": True}


@router.post("/reset-password")
def reset_password(
    payload: PasswordResetConsumeRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> dict[str, bool]:
    with uow as db:
        admin_service.consume_password_reset(
            db,
            token=payload.token,
            new_password=payload.new_password,
            actor_ip=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    return {"ok": True}


@router.post("/mfa/enroll/start", response_model=MfaEnrollStartOut)
def mfa_enroll_start(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> MfaEnrollStartOut:
    with uow as db:
        user = db.get(User, current_user.id)
        if user is None:
            raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
        secret, uri = begin_mfa_enrollment(db, user=user)
        return MfaEnrollStartOut(secret=secret, otpauth_url=uri, mfa_enabled=bool(user.mfa_enabled))


@router.post("/mfa/enroll/verify", response_model=MfaStatusOut)
def mfa_enroll_verify(
    payload: MfaCodeIn,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> MfaStatusOut:
    with uow as db:
        user = db.get(User, current_user.id)
        if user is None:
            raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
        confirm_mfa_enrollment(db, user=user, otp_code=payload.otp_code)
        return MfaStatusOut(ok=True, mfa_enabled=bool(user.mfa_enabled))


@router.post("/mfa/disable", response_model=MfaStatusOut)
def mfa_disable(
    payload: MfaCodeIn,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
    _idmp=Depends(idempotency_guard),
) -> MfaStatusOut:
    with uow as db:
        user = db.get(User, current_user.id)
        if user is None:
            raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
        disable_mfa(db, user=user, otp_code=payload.otp_code)
        return MfaStatusOut(ok=True, mfa_enabled=bool(user.mfa_enabled))
