from __future__ import annotations

from types import SimpleNamespace

import pytest
from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.tenancy.deps import get_current_tenant
from app.db.session import get_db
from app.main import app
from app.modules.dms.api import _require_match_or_allow
from fastapi import Request
from fastapi.testclient import TestClient


class _DummyDb:
    def commit(self):
        return None


def test_funding_idempotent_double_submit_replays_and_avoids_duplicate_side_effect(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"create": 0}
    store: dict[str, dict] = {}

    def fake_get_db():
        yield _DummyDb()

    def fake_user():
        return SimpleNamespace(id="user-1")

    def fake_tenant(request: Request):
        request.state.tenant_id = "tenant-1"
        request.state.tenant_role = "ADMIN"
        return SimpleNamespace(id="tenant-1")

    def fake_start_idempotent_request(**kwargs):
        key = kwargs.get("idempotency_key")
        if key in store:
            return SimpleNamespace(record=None, replay=store[key], status_code=200)
        return SimpleNamespace(record=SimpleNamespace(), replay=None, status_code=None)

    def fake_finalize_idempotent_request(*, record, status_code, response_json, resource_type=None, resource_id=None):
        if record is not None:
            store["k-1"] = response_json

    def fake_create_deal(**kwargs):
        calls["create"] += 1
        return SimpleNamespace(
            tenant_id="tenant-1",
            doc_type="funding_checklist",
            doc_id="deal-1",
            version=1,
            updated_at=None,
            document={"status": "open"},
        )

    monkeypatch.setattr("app.modules.funding.api.start_idempotent_request", fake_start_idempotent_request)
    monkeypatch.setattr("app.modules.funding.api.finalize_idempotent_request", fake_finalize_idempotent_request)
    monkeypatch.setattr("app.modules.funding.api.create_deal", fake_create_deal)
    monkeypatch.setattr("app.modules.funding.api.log_audit_event", lambda **kwargs: None)

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_current_tenant] = fake_tenant
    app.dependency_overrides[idempotency_guard] = lambda: None
    client = TestClient(app)
    try:
        payload = {"deal_id": "deal-1", "customer_name": "Jane", "vehicle": "VIN123"}
        headers = {"X-Tenant-Id": "tenant-1", "Idempotency-Key": "k-1"}
        r1 = client.post("/api/v1/funding/deals", json=payload, headers=headers)
        r2 = client.post("/api/v1/funding/deals", json=payload, headers=headers)
    finally:
        app.dependency_overrides.clear()

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()
    assert calls["create"] == 1


def test_stale_write_rejected_with_canonical_error() -> None:
    with pytest.raises(AppError) as exc:
        _require_match_or_allow("Customer", current_version=3, if_match='"2"')

    assert exc.value.code == "version_mismatch"
    assert exc.value.status_code == 409
