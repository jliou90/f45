from __future__ import annotations

from app.core.auth.jwt import decode_token_safely
from app.core.errors import AppError
from app.db.session import get_db
from app.modules.identity.models import User
from fastapi import Depends, Request
from sqlalchemy.orm import Session


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    return token or None


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = _extract_bearer_token(request)
    if not token:
        return None

    payload = decode_token_safely(token)
    if not payload:
        return None

    sub = payload.get("sub")
    if not sub:
        return None

    user = db.get(User, sub)
    if user and (user.is_disabled or not user.is_active):
        return None
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Require a valid access token and return the corresponding user."""
    token = _extract_bearer_token(request)
    if not token:
        raise AppError(code="auth_missing", message="Missing Authorization header", status_code=401)

    payload = decode_token_safely(token)
    if not payload:
        raise AppError(code="auth_invalid", message="Invalid or expired token", status_code=401)

    if payload.get("type") == "refresh":
        raise AppError(code="auth_invalid", message="Refresh token cannot be used for API access", status_code=401)

    sub = payload.get("sub")
    if not sub:
        raise AppError(code="auth_invalid", message="Invalid token payload", status_code=401)

    user = db.get(User, sub)
    if not user:
        raise AppError(code="auth_user_not_found", message="User not found", status_code=401)
    if user.is_disabled or not user.is_active:
        raise AppError(code="auth_user_disabled", message="User is disabled", status_code=401)

    return user
