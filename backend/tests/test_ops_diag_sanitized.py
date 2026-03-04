from __future__ import annotations

from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


def _provision_admin_with_tenant() -> tuple[str, str, str]:
    suffix = uuid4().hex[:10]
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    email = f"diag-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.add(Tenant(id=tenant_id, name=f"diag-{uuid4().hex[:8]}"))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role="ADMIN")
    finally:
        db.close()
    return tenant_id, email, password


def test_ops_diag_is_protected_and_sanitized() -> None:
    app = create_app()
    client = TestClient(app)

    unauth = client.get("/api/v1/ops/diag")
    assert unauth.status_code == 401

    tenant_id, email, password = _provision_admin_with_tenant()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text

    token = login.json()["access_token"]
    resp = client.get(
        "/api/v1/ops/diag",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "build" in body
    assert "config" in body
    serialized = str(body).lower()
    assert "jwt_secret" not in serialized
    assert "db_password" not in serialized
    assert "bootstrap_token" not in serialized
    assert body["build"].get("version")
    assert "git_sha" in body["build"]


def test_ops_version_includes_build_metadata() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/api/v1/ops/version")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["service"] == "kutm-backend"
    assert "version" in payload
    assert "git_sha" in payload
    assert "build_time" in payload
