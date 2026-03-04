from __future__ import annotations

from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


def _provision_user(role: str) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    email = f"ops-{role.lower()}-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.add(Tenant(id=tenant_id, name=f"ops-{suffix}"))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role=role)
    finally:
        db.close()

    return tenant_id, email, password


def _login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_ops_status_fields_and_request_id_present() -> None:
    app = create_app()
    client = TestClient(app)

    tenant_id, email, password = _provision_user("ADMIN")
    token = _login(client, email, password)

    response = client.get(
        "/api/v1/ops/status",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id, "X-Request-Id": "ops-status-1"},
    )
    assert response.status_code == 200, response.text
    assert response.headers.get("X-Request-Id") == "ops-status-1"

    payload = response.json()
    assert "service" in payload
    assert "version" in payload
    assert "server_time" in payload
    assert "db" in payload
    assert "migrations" in payload
    assert isinstance(payload.get("recent_errors"), list)


def test_ops_logs_and_status_are_admin_only() -> None:
    app = create_app()
    client = TestClient(app)

    tenant_id, email, password = _provision_user("USER")
    token = _login(client, email, password)

    status_resp = client.get(
        "/api/v1/ops/status",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id},
    )
    assert status_resp.status_code == 403

    logs_resp = client.get(
        "/api/v1/ops/logs/tail",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id},
    )
    assert logs_resp.status_code == 403


def test_ops_events_stub_is_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("KUTM_FLAG_REALTIME_STUB_ENABLED", raising=False)
    app = create_app()
    client = TestClient(app)

    response = client.get("/api/v1/ops/events")
    assert response.status_code == 404


def test_ops_events_stub_can_be_enabled_explicitly(monkeypatch) -> None:
    monkeypatch.setenv("KUTM_FLAG_REALTIME_STUB_ENABLED", "1")
    app = create_app()
    client = TestClient(app)

    response = client.get("/api/v1/ops/events")
    assert response.status_code == 501
