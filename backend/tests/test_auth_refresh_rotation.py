from __future__ import annotations

from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from fastapi.testclient import TestClient


def _create_user(password: str = "Password123!") -> tuple[str, str]:
    email = f"refresh-{uuid4().hex[:10]}@example.com"
    user = User(id=str(uuid4()), email=email, password_hash=hash_password(password))
    db = SessionLocal()
    try:
        db.add(user)
        db.commit()
    finally:
        db.close()
    return email, password


def test_refresh_token_rotation_rejects_replay() -> None:
    email, password = _create_user()
    app = create_app()
    client = TestClient(app)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    initial_refresh = login.json()["refresh_token"]

    rotate_1 = client.post("/api/v1/auth/refresh", json={"refresh_token": initial_refresh})
    assert rotate_1.status_code == 200, rotate_1.text
    rotated_refresh = rotate_1.json()["refresh_token"]
    assert rotated_refresh != initial_refresh

    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": initial_refresh})
    assert replay.status_code == 401, replay.text
    assert replay.json()["code"] == "auth_refresh_replayed"

    rotate_2 = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated_refresh})
    assert rotate_2.status_code == 200, rotate_2.text
