from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token_safely,
)
from app.core.config import settings
from app.core.errors import AppError
from app.core.mfa import generate_base32_secret, provisioning_uri, verify_totp
from app.core.security import hash_password, verify_password
from app.modules.identity.models import RefreshToken, User
from sqlalchemy import update
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _jti_hash(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def _opt_hash(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _audit_auth_event(event: str, **extra: object) -> None:
    logger.info("auth_event=%s", event, extra={"auth_event": event, **extra})


def _is_locked(user: User, now: datetime) -> bool:
    return bool(user.locked_until and user.locked_until > now)


def authenticate(db: Session, email: str, password: str, otp_code: str | None = None) -> User | None:
    now = _utcnow()
    user = db.query(User).filter(User.email == email.strip().lower()).one_or_none()
    if not user:
        _audit_auth_event("login_failed", reason="user_not_found", email=email.strip().lower())
        return None

    if user.is_disabled or not user.is_active:
        _audit_auth_event("login_failed", reason="user_disabled", user_id=user.id)
        return None

    if settings.login_lockout_enabled and _is_locked(user, now):
        _audit_auth_event("login_failed", reason="account_locked", user_id=user.id)
        return None

    if not verify_password(password, user.password_hash):
        if settings.login_lockout_enabled:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.login_lockout_threshold:
                user.locked_until = now + timedelta(minutes=settings.login_lockout_minutes)
            db.add(user)
        _audit_auth_event("login_failed", reason="bad_password", user_id=user.id)
        return None

    if bool(user.mfa_enabled):
        if not user.mfa_secret:
            _audit_auth_event("login_failed", reason="mfa_secret_missing", user_id=user.id)
            raise AppError(
                code="auth_mfa_required",
                message="MFA code required",
                status_code=401,
            )
        if not otp_code or not verify_totp(user.mfa_secret, otp_code):
            _audit_auth_event("login_failed", reason="mfa_invalid", user_id=user.id)
            raise AppError(
                code="auth_mfa_required",
                message="MFA code required",
                status_code=401,
            )

    if user.failed_login_attempts or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)

    _audit_auth_event("login_succeeded", user_id=user.id)
    return user


def _persist_refresh_token(
    db: Session,
    *,
    user_id: str,
    token: str,
    parent_jti_hash: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> RefreshToken:
    payload = decode_token_safely(token)
    if not payload:
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    jti = payload.get("jti")
    exp = payload.get("exp")
    if not isinstance(jti, str) or not isinstance(exp, int):
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    token_row = RefreshToken(
        id=str(uuid4()),
        user_id=user_id,
        jti_hash=_jti_hash(jti),
        expires_at=datetime.fromtimestamp(exp, tz=UTC),
        parent_jti_hash=parent_jti_hash,
        last_seen_at=_utcnow(),
        user_agent_hash=_opt_hash(user_agent),
        ip_hash=_opt_hash(ip_address),
    )
    db.add(token_row)
    return token_row


def issue_token_pair(
    db: Session,
    *,
    user: User,
    parent_jti_hash: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    access = create_access_token(user_id=user.id, roles=["user"])
    refresh = create_refresh_token(user_id=user.id)
    _persist_refresh_token(
        db,
        user_id=user.id,
        token=refresh,
        parent_jti_hash=parent_jti_hash,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return access, refresh


def _validate_refresh_token(db: Session, refresh_token: str) -> tuple[User, RefreshToken, str]:
    payload = decode_token_safely(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")
    if not isinstance(user_id, str) or not isinstance(jti, str):
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    token_row = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.jti_hash == _jti_hash(jti))
        .one_or_none()
    )
    if token_row is None:
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    if token_row.revoked_at is not None:
        _audit_auth_event("refresh_rejected", reason="replay_detected", user_id=user_id)
        raise AppError(
            code="auth_refresh_replayed",
            message="Refresh token already used",
            status_code=401,
        )

    if token_row.expires_at <= _utcnow():
        raise AppError(
            code="auth_invalid_refresh",
            message="Refresh token expired",
            status_code=401,
        )

    user = db.get(User, user_id)
    if not user:
        raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
    if user.is_disabled or not user.is_active:
        raise AppError(code="auth_user_disabled", message="User is disabled", status_code=401)

    return user, token_row, _jti_hash(jti)


def rotate_refresh_token(
    db: Session,
    *,
    refresh_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    user, token_row, old_jti_hash = _validate_refresh_token(db, refresh_token)
    token_row.revoked_at = _utcnow()
    token_row.revoked_reason = "rotated"
    token_row.last_seen_at = _utcnow()
    token_row.user_agent_hash = _opt_hash(user_agent)
    token_row.ip_hash = _opt_hash(ip_address)
    db.add(token_row)

    access, new_refresh = issue_token_pair(
        db,
        user=user,
        parent_jti_hash=old_jti_hash,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    _audit_auth_event("refresh_rotated", user_id=user.id)
    return access, new_refresh


def revoke_refresh_token(
    db: Session,
    *,
    refresh_token: str,
    reason: str = "logout",
    expected_user_id: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> bool:
    user, token_row, _ = _validate_refresh_token(db, refresh_token)
    if expected_user_id is not None and user.id != expected_user_id:
        raise AppError(
            code="auth_invalid_refresh",
            message="Invalid refresh token",
            status_code=401,
        )

    token_row.revoked_at = _utcnow()
    token_row.revoked_reason = reason
    token_row.last_seen_at = _utcnow()
    token_row.user_agent_hash = _opt_hash(user_agent)
    token_row.ip_hash = _opt_hash(ip_address)
    db.add(token_row)
    _audit_auth_event("refresh_revoked_one", user_id=user.id, reason=reason)
    return True


def purge_expired_and_revoked_refresh_tokens(db: Session) -> dict[str, int]:
    now = _utcnow()
    expired_deleted = int(
        db.query(RefreshToken)
        .filter(RefreshToken.expires_at <= now)
        .delete(synchronize_session=False)
        or 0
    )
    revoked_deleted = int(
        db.query(RefreshToken)
        .filter(RefreshToken.revoked_at.is_not(None))
        .delete(synchronize_session=False)
        or 0
    )
    _audit_auth_event(
        "refresh_cleanup_ran",
        expired_deleted=expired_deleted,
        revoked_deleted=revoked_deleted,
    )
    return {
        "expired_deleted": expired_deleted,
        "revoked_deleted": revoked_deleted,
    }


def revoke_all_refresh_tokens_for_user(db: Session, *, user_id: str, reason: str) -> int:
    now = _utcnow()
    stmt = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now, revoked_reason=reason)
    )
    result = db.execute(stmt)
    count = int(result.rowcount or 0)
    _audit_auth_event("refresh_revoked_all", user_id=user_id, reason=reason, revoked_count=count)
    return count


def change_password(db: Session, *, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AppError(
            code="auth_invalid_credentials",
            message="Invalid credentials",
            status_code=401,
        )

    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    revoke_all_refresh_tokens_for_user(db, user_id=user.id, reason="password_changed")
    _audit_auth_event("password_changed", user_id=user.id)


def disable_user(db: Session, *, user: User) -> None:
    user.is_disabled = True
    user.is_active = False
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    revoke_all_refresh_tokens_for_user(db, user_id=user.id, reason="user_disabled")
    _audit_auth_event("user_disabled", user_id=user.id)


def begin_mfa_enrollment(db: Session, *, user: User, issuer: str = "KUTM") -> tuple[str, str]:
    if user.is_disabled or not user.is_active:
        raise AppError(code="auth_user_disabled", message="User is disabled", status_code=401)
    secret = generate_base32_secret(32)
    user.mfa_secret = secret
    user.mfa_enabled = False
    db.add(user)
    _audit_auth_event("mfa_enroll_started", user_id=user.id)
    return secret, provisioning_uri(account_name=user.email, issuer=issuer, secret=secret)


def confirm_mfa_enrollment(db: Session, *, user: User, otp_code: str) -> None:
    if not user.mfa_secret:
        raise AppError(code="auth_mfa_not_initialized", message="MFA enrollment not started", status_code=400)
    if not verify_totp(user.mfa_secret, otp_code):
        raise AppError(code="auth_mfa_invalid_code", message="Invalid MFA code", status_code=400)
    user.mfa_enabled = True
    db.add(user)
    _audit_auth_event("mfa_enabled", user_id=user.id)


def disable_mfa(db: Session, *, user: User, otp_code: str) -> None:
    if not user.mfa_enabled or not user.mfa_secret:
        raise AppError(code="auth_mfa_not_enabled", message="MFA is not enabled", status_code=400)
    if not verify_totp(user.mfa_secret, otp_code):
        raise AppError(code="auth_mfa_invalid_code", message="Invalid MFA code", status_code=400)
    user.mfa_enabled = False
    user.mfa_secret = None
    db.add(user)
    _audit_auth_event("mfa_disabled", user_id=user.id)
