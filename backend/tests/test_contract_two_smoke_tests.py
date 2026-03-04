from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.core.auth.deps import get_current_user
from app.core.tenancy.deps import get_current_tenant
from app.main import app
from fastapi import Request
from fastapi.testclient import TestClient

client = TestClient(app)


def assert_error_envelope(body: dict[str, Any]) -> None:
    # canonical error keys
    assert "code" in body and isinstance(body["code"], str)
    assert "message" in body and isinstance(body["message"], str)
    assert "details" in body  # can be anything or None
    assert "request_id" in body  # can be None or str
    if body["request_id"] is not None:
        assert isinstance(body["request_id"], str)


def assert_page_envelope(body: dict[str, Any]) -> None:
    assert "items" in body and isinstance(body["items"], list)
    assert "meta" in body and isinstance(body["meta"], dict)

    meta = body["meta"]
    assert "page" in meta and isinstance(meta["page"], int)
    assert "size" in meta and isinstance(meta["size"], int)
    assert "total" in meta and isinstance(meta["total"], int)


def test_error_envelope_404() -> None:
    r = client.get("/this-route-does-not-exist")
    assert r.status_code == 404
    assert_error_envelope(r.json())


def test_error_envelope_422_validation() -> None:
    r = client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    body = r.json()
    assert_error_envelope(body)

    # Optional: verify details is field-ish (depends on your implementation)
    assert body["details"] is not None


def test_list_envelope_example() -> None:
    def _fake_user():
        return SimpleNamespace(id="user-1")

    def _fake_tenant_admin(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        return SimpleNamespace(id="tenant-1")

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant_admin
    try:
        r = client.get("/api/v1/rbac/roles?page=1&size=10")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert_page_envelope(r.json())
