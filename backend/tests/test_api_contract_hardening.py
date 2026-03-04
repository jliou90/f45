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


def test_404_error_response_shape() -> None:
    r = client.get("/api/v1/does-not-exist")
    assert r.status_code == 404
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "not_found"
    assert body["message"] == "Not Found"
    assert body["request_id"] == r.headers.get("x-request-id")


def test_401_error_response_shape() -> None:
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "auth_missing"
    assert body["request_id"] == r.headers.get("x-request-id")


def test_403_error_response_shape() -> None:
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


def test_validation_error_shape_has_field_details() -> None:
    r = client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    body = r.json()
    _assert_error_shape(body)
    assert body["code"] == "validation_error"
    assert isinstance(body["details"], list)
    assert body["details"]
    first = body["details"][0]
    assert {"field", "message", "type"}.issubset(first.keys())


def test_collection_returns_page_result_shape() -> None:
    def _fake_tenant_admin(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_tenant] = _fake_tenant_admin
    try:
        r = client.get("/api/v1/rbac/roles?page=1&size=25&sort=name&q=adm")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"items", "meta"}
    assert isinstance(body["items"], list)
    assert set(body["meta"].keys()) == {"page", "size", "total"}
    assert body["meta"]["page"] == 1
    assert body["meta"]["size"] == 25


def test_rbac_roles_and_permissions_catalogs_return_data() -> None:
    def _fake_tenant_admin(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_tenant] = _fake_tenant_admin
    try:
        roles = client.get("/api/v1/rbac/roles", headers={"X-Tenant-Id": "tenant-1"})
        perms = client.get("/api/v1/rbac/permissions", headers={"X-Tenant-Id": "tenant-1"})
        member_perms = client.get(
            "/api/v1/rbac/permissions?role=member",
            headers={"X-Tenant-Id": "tenant-1"},
        )
    finally:
        app.dependency_overrides.clear()

    assert roles.status_code == 200
    assert roles.json()["items"]
    assert "ADMIN" in roles.json()["items"]

    assert perms.status_code == 200
    assert perms.json()["items"]
    assert "rbac.read" in perms.json()["items"]

    assert member_perms.status_code == 200
    member_items = member_perms.json()["items"]
    assert member_items
    assert "rbac.read" in member_items
