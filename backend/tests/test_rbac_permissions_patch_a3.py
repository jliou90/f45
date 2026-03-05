from __future__ import annotations

from types import SimpleNamespace

from app.core.auth.deps import get_current_user
from app.core.tenancy.deps import get_current_tenant
from app.main import app
from fastapi import Request
from fastapi.testclient import TestClient

client = TestClient(app)


def _assert_error_shape(payload: dict) -> None:
    assert {"code", "message", "details", "request_id"}.issubset(payload.keys())
    assert isinstance(payload["code"], str)
    assert isinstance(payload["message"], str)
    assert payload["request_id"] is None or isinstance(payload["request_id"], str)


def test_permission_guard_401_when_unauthenticated() -> None:
    r = client.get("/api/v1/integrations/webhooks", headers={"X-Tenant-Id": "tenant-1"})
    assert r.status_code == 401
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "auth_missing"
    assert body["request_id"] == r.headers.get("x-request-id")


def test_permission_guard_403_forbidden_read_with_tenant_context() -> None:
    def _fake_user():
        return SimpleNamespace(id="user-1")

    def _fake_tenant_member(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "MEMBER"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant_member
    try:
        r = client.get("/api/v1/integrations/webhooks", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 403
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "permission_denied"
    assert body["request_id"] == r.headers.get("x-request-id")


def test_permission_guard_403_forbidden_write_with_tenant_context() -> None:
    def _fake_user():
        return SimpleNamespace(id="user-1")

    def _fake_tenant_member(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "MEMBER"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant_member
    try:
        r = client.post("/api/v1/acct/periods/seed-year?year=2026", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 403
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "permission_denied"
    assert body["request_id"] == r.headers.get("x-request-id")


def test_permission_guard_allows_admin() -> None:
    def _fake_user():
        return SimpleNamespace(id="user-1")

    def _fake_tenant_admin(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant_admin
    try:
        r = client.get("/api/v1/rbac/roles", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"items", "meta"}


def test_permission_guard_admin_merges_preset_permissions() -> None:
    def _fake_user():
        return SimpleNamespace(id="user-1")

    def _fake_tenant_admin_with_preset(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        # Simulate middleware/session state carrying an incomplete permission set.
        request.state.tenant_permissions = ["admin.users.read"]
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant_admin_with_preset
    try:
        r = client.get("/api/v1/dms/customers", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200, r.text
