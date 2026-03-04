from __future__ import annotations

from types import SimpleNamespace

from app.core.auth.deps import get_current_user
from app.core.tenancy.deps import get_current_tenant
from app.db.session import get_db
from app.main import app
from fastapi import Request
from fastapi.testclient import TestClient


class _FakeQuery:
    def filter(self, *args, **kwargs):
        return self

    def one_or_none(self):
        return None


class _FakeDb:
    def query(self, *args, **kwargs):
        return _FakeQuery()


def _fake_db():
    yield _FakeDb()


def _fake_user():
    return SimpleNamespace(id="user-1")


def _fake_tenant(request: Request):
    request.state.tenant_id = "tenant-1"
    request.state.tenant_role = "ADMIN"
    return SimpleNamespace(id="tenant-1")


def _assert_error_envelope(payload: dict) -> None:
    assert {"code", "message", "details", "request_id"}.issubset(payload.keys())


def test_missing_deal_get_by_id_returns_404_envelope() -> None:
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant
    client = TestClient(app)
    try:
        resp = client.get("/api/v1/deals/missing-deal", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 404
    body = resp.json()
    _assert_error_envelope(body)
    assert body["code"] == "deal_not_found"


def test_missing_inventory_get_by_id_returns_404_envelope() -> None:
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant
    client = TestClient(app)
    try:
        resp = client.get("/api/v1/inventory/units/missing-unit", headers={"X-Tenant-Id": "tenant-1"})
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 404
    body = resp.json()
    _assert_error_envelope(body)
    assert body["code"] == "inventory_not_found"
