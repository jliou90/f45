from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import RefreshToken, User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _provision_user_with_admin_tenant(password: str = "Password123!") -> tuple[str, str, str, str]:
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    email = f"auth-e3-{uuid4().hex[:10]}@example.com"

    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.add(Tenant(id=tenant_id, name=f"auth-e3-{uuid4().hex[:8]}"))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role="ADMIN")
    finally:
        db.close()
    return user_id, email, password, tenant_id


def test_logout_revokes_current_refresh_token() -> None:
    user_id, email, password, _tenant_id = _provision_user_with_admin_tenant()
    client = TestClient(create_app())
    try:
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        access = login.json()["access_token"]
        refresh = login.json()["refresh_token"]

        logout = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access}"},
            json={"refresh_token": refresh},
        )
        assert logout.status_code == 200, logout.text
        assert logout.json()["ok"] is True

        replay = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert replay.status_code == 401, replay.text
        assert replay.json()["code"] == "auth_refresh_replayed"

        db = SessionLocal()
        try:
            row = db.query(RefreshToken).filter(RefreshToken.user_id == user_id).order_by(RefreshToken.created_at.desc()).first()
            assert row is not None
            assert row.revoked_at is not None
            assert row.revoked_reason == "logout"
        finally:
            db.close()
    finally:
        client.close()


def test_cleanup_endpoint_removes_expired_and_revoked_tokens() -> None:
    user_id, email, password, tenant_id = _provision_user_with_admin_tenant()
    client = TestClient(create_app())
    try:
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        access = login.json()["access_token"]
        refresh = login.json()["refresh_token"]

        logout = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access}"},
            json={"refresh_token": refresh},
        )
        assert logout.status_code == 200, logout.text

        db = SessionLocal()
        try:
            db.add(
                RefreshToken(
                    id=str(uuid4()),
                    user_id=user_id,
                    jti_hash=hashlib.sha256(f"expired-{uuid4()}".encode()).hexdigest(),
                    expires_at=datetime.now(UTC) - timedelta(days=1),
                    revoked_at=None,
                    revoked_reason=None,
                    parent_jti_hash=None,
                    last_seen_at=None,
                    user_agent_hash=None,
                    ip_hash=None,
                )
            )
            db.commit()
        finally:
            db.close()

        cleanup = client.post(
            "/api/v1/ops/auth/cleanup-refresh-tokens",
            headers={"Authorization": f"Bearer {access}", "X-Tenant-Id": tenant_id},
        )
        assert cleanup.status_code == 200, cleanup.text
        body = cleanup.json()
        assert body["expired_deleted"] >= 1
        assert body["revoked_deleted"] >= 1

        db = SessionLocal()
        try:
            remaining = (
                db.query(RefreshToken)
                .filter(RefreshToken.user_id == user_id)
                .all()
            )
            assert len(remaining) == 0
        finally:
            db.close()
    finally:
        client.close()


def test_refresh_token_metadata_persisted_and_updated() -> None:
    user_id, email, password, _tenant_id = _provision_user_with_admin_tenant()
    client = TestClient(create_app())
    try:
        login = client.post(
            "/api/v1/auth/login",
            headers={"User-Agent": "kutm-e3-login-agent", "X-Forwarded-For": "203.0.113.10"},
            json={"email": email, "password": password},
        )
        assert login.status_code == 200, login.text
        refresh = login.json()["refresh_token"]

        db = SessionLocal()
        try:
            first = (
                db.query(RefreshToken)
                .filter(RefreshToken.user_id == user_id)
                .order_by(RefreshToken.created_at.desc())
                .first()
            )
            assert first is not None
            assert first.last_seen_at is not None
            assert first.user_agent_hash == _sha256("kutm-e3-login-agent")
            assert first.ip_hash == _sha256("203.0.113.10")
        finally:
            db.close()

        rotate = client.post(
            "/api/v1/auth/refresh",
            headers={"User-Agent": "kutm-e3-refresh-agent", "X-Forwarded-For": "203.0.113.11"},
            json={"refresh_token": refresh},
        )
        assert rotate.status_code == 200, rotate.text
        rotated_refresh = rotate.json()["refresh_token"]
        assert rotated_refresh != refresh

        db = SessionLocal()
        try:
            rows = (
                db.query(RefreshToken)
                .filter(RefreshToken.user_id == user_id)
                .order_by(RefreshToken.created_at.asc())
                .all()
            )
            assert len(rows) >= 2
            old_row = rows[0]
            new_row = rows[-1]
            assert old_row.revoked_at is not None
            assert old_row.user_agent_hash == _sha256("kutm-e3-refresh-agent")
            assert old_row.ip_hash == _sha256("203.0.113.11")
            assert new_row.last_seen_at is not None
            assert new_row.user_agent_hash == _sha256("kutm-e3-refresh-agent")
            assert new_row.ip_hash == _sha256("203.0.113.11")
        finally:
            db.close()
    finally:
        client.close()
