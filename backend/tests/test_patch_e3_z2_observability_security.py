from __future__ import annotations

import logging
from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


def _provision_admin_with_tenants(*tenant_ids: str) -> tuple[str, str]:
    suffix = uuid4().hex[:10]
    user_id = str(uuid4())
    email = f"ops-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        for tenant_id in tenant_ids:
            db.add(Tenant(id=tenant_id, name=f"ops-{uuid4().hex[:8]}"))
        db.commit()
        for tenant_id in tenant_ids:
            tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role="ADMIN")
    finally:
        db.close()

    return email, password


def test_success_logs_include_request_id(caplog) -> None:
    app = create_app()
    client = TestClient(app)
    caplog.set_level(logging.INFO)

    resp = client.get("/health", headers={"X-Request-Id": "req-success-1"})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-Id") == "req-success-1"

    msgs = [r.getMessage() for r in caplog.records if "http_request" in r.getMessage()]
    assert any("request_id=req-success-1" in m for m in msgs)


def test_rate_limit_on_login_endpoint(monkeypatch) -> None:
    monkeypatch.setenv("KUTM_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("KUTM_RATE_LIMIT_PER_MIN", "1")
    app = create_app()
    client = TestClient(app)

    r1 = client.post("/api/v1/auth/login", json={})
    r2 = client.post("/api/v1/auth/login", json={})

    assert r1.status_code in {401, 422}
    assert r2.status_code == 429
    assert r2.json()["code"] == "rate_limited"


def test_ops_diagnostics_is_protected_and_redacted() -> None:
    app = create_app()
    client = TestClient(app)

    unauth = client.get("/api/v1/ops/diagnostics")
    assert unauth.status_code == 401

    tenant_id = str(uuid4())
    email, password = _provision_admin_with_tenants(tenant_id)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]

    resp = client.get(
        "/api/v1/ops/diagnostics",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": tenant_id,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "feature_flags" in body
    serialized = str(body).lower()
    assert "jwt_secret" not in serialized
    assert "password" not in serialized


def test_rate_limit_is_tenant_aware_for_tenant_scoped_posts(monkeypatch) -> None:
    monkeypatch.setenv("KUTM_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("KUTM_RATE_LIMIT_PER_MIN", "1")
    app = create_app()
    client = TestClient(app)

    tenant_a = str(uuid4())
    tenant_b = str(uuid4())
    email, password = _provision_admin_with_tenants(tenant_a, tenant_b)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]

    h_a = {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_a}
    h_b = {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_b}

    r1 = client.post("/api/v1/funding/deals", headers=h_a, json={})
    r2 = client.post("/api/v1/funding/deals", headers=h_b, json={})
    r3 = client.post("/api/v1/funding/deals", headers=h_a, json={})

    assert r1.status_code == 422
    assert r2.status_code == 422
    assert r3.status_code == 429
    assert r3.json()["code"] == "rate_limited"


def test_security_headers_present_on_success_path() -> None:
    app = create_app()
    client = TestClient(app)
    resp = client.get("/health")

    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "same-origin"
