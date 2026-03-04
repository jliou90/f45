from __future__ import annotations

from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.identity.service import disable_user
from fastapi.testclient import TestClient


def _create_user(password: str = "Password123!") -> tuple[str, str, str]:
    user_id = str(uuid4())
    email = f"revoke-{uuid4().hex[:10]}@example.com"
    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.commit()
    finally:
        db.close()
    return user_id, email, password


def test_password_change_revokes_existing_refresh_tokens() -> None:
    _, email, password = _create_user()
    app = create_app()
    client = TestClient(app)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    access = login.json()["access_token"]
    refresh = login.json()["refresh_token"]

    change = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={"current_password": password, "new_password": "Password456!"},
    )
    assert change.status_code == 200, change.text
    assert change.json()["ok"] is True

    refresh_after_change = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert refresh_after_change.status_code == 401, refresh_after_change.text
    assert refresh_after_change.json()["code"] == "auth_refresh_replayed"

    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert old_login.status_code == 401, old_login.text

    new_login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password456!"})
    assert new_login.status_code == 200, new_login.text


def test_disabled_user_cannot_login_or_refresh() -> None:
    user_id, email, password = _create_user()
    app = create_app()
    client = TestClient(app)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    refresh = login.json()["refresh_token"]

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        disable_user(db, user=user)
        db.commit()
    finally:
        db.close()

    login_blocked = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_blocked.status_code == 401, login_blocked.text

    refresh_blocked = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert refresh_blocked.status_code == 401, refresh_blocked.text
    assert refresh_blocked.json()["code"] == "auth_refresh_replayed"
