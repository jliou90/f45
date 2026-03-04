from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from app.core.config import settings
from jwt import InvalidTokenError


def create_access_token(*, user_id: str, roles: list[str]) -> str:
    """Patch 2 contract:
    - Token contains user_id (as `sub`) and `roles`
    - Token MUST NOT embed tenant identity
    """
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.access_token_minutes)

    payload: dict[str, Any] = {
        "sub": user_id,
        "roles": roles,
        "jti": str(uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def create_refresh_token(*, user_id: str) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.refresh_token_days)

    payload: dict[str, Any] = {
        "sub": user_id,
        "type": "refresh",
        "jti": str(uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_token_safely(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except InvalidTokenError:
        return None
