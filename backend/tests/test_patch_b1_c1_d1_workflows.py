from __future__ import annotations

from types import SimpleNamespace

import pytest
from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.tenancy.deps import get_current_tenant
from app.db.session import get_db
from app.main import app
from app.modules.deals.projection import project_deal_summary
from app.modules.deals.service import transition_deal
from app.modules.inventory.projection import project_inventory_unit
from app.modules.inventory.service import transition_unit
from app.modules.service_ro.service import append_ro_event
from fastapi import Request
from fastapi.testclient import TestClient


def _fake_user():
    return SimpleNamespace(id="user-1")


def _fake_tenant(request: Request):
    request.state.tenant_id = "tenant-1"
    request.state.tenant_role = "ADMIN"
    return SimpleNamespace(id="tenant-1")


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def one_or_none(self):
        return self._result


class _FakeDb:
    def __init__(self, existing_batch=None):
        self.added = []
        self._existing_batch = existing_batch

    def query(self, *args, **kwargs):
        return _FakeQuery(self._existing_batch)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        return None


def test_b1_invalid_transition_rejected() -> None:
    db = _FakeDb()
    actor = SimpleNamespace(id="u1")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.modules.deals.service.get_deal_doc", lambda **kwargs: SimpleNamespace(document={"state": "quote"}))
        with pytest.raises(AppError) as exc:
            transition_deal(
                db=db,
                tenant_id="tenant-1",
                actor=actor,
                deal_id="d1",
                to_state="booked",
                reason=None,
                payload={},
            )
    assert exc.value.code == "deal_transition_invalid"


def test_b1_valid_transition_creates_booking_hook() -> None:
    db = _FakeDb(existing_batch=None)
    actor = SimpleNamespace(id="u1")
    outbox = {"count": 0}
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.modules.deals.service.get_deal_doc", lambda **kwargs: SimpleNamespace(document={"state": "funded"}))
        mp.setattr("app.modules.deals.service.append_event", lambda **kwargs: None)
        mp.setattr(
            "app.modules.deals.service.rebuild_deal_summary",
            lambda **kwargs: SimpleNamespace(
                tenant_id="tenant-1",
                doc_type="deal_summary",
                doc_id="d1",
                version=3,
                updated_at=None,
                document={"state": "booked"},
            ),
        )
        mp.setattr("app.modules.deals.service.enqueue_outbox", lambda **kwargs: outbox.__setitem__("count", outbox["count"] + 1))
        doc = transition_deal(
            db=db,
            tenant_id="tenant-1",
            actor=actor,
            deal_id="d1",
            to_state="booked",
            reason=None,
            payload={},
        )
    assert doc.document["state"] == "booked"
    assert any(getattr(x, "doc_type", "") == "DEAL_BOOK" for x in db.added)
    assert outbox["count"] >= 1


def test_b1_transition_api_records_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    audit = {"count": 0}

    def fake_get_db():
        yield _FakeDb()

    monkeypatch.setattr(
        "app.modules.deals.api.start_idempotent_request",
        lambda **kwargs: SimpleNamespace(record=SimpleNamespace(), replay=None, status_code=None),
    )
    monkeypatch.setattr("app.modules.deals.api.finalize_idempotent_request", lambda **kwargs: None)
    monkeypatch.setattr(
        "app.modules.deals.api.transition_deal",
        lambda **kwargs: SimpleNamespace(
            tenant_id="tenant-1",
            doc_type="deal_summary",
            doc_id="d1",
            version=2,
            updated_at=None,
            document={"state": "penciled"},
        ),
    )
    monkeypatch.setattr("app.modules.deals.api.log_audit_event", lambda **kwargs: audit.__setitem__("count", audit["count"] + 1))

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant
    app.dependency_overrides[idempotency_guard] = lambda: None
    client = TestClient(app)
    try:
        r = client.post(
            "/api/v1/deals/d1/transition",
            headers={"X-Tenant-Id": "tenant-1", "Idempotency-Key": "d-k1"},
            json={"to_state": "penciled", "payload": {}},
        )
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert audit["count"] == 1


def test_c1_inventory_rollup_correctness() -> None:
    events = [
        SimpleNamespace(event_type="inventory.acquired", payload={"unit_id": "u1", "acquired_cost_cents": 1_000}, occurred_at=SimpleNamespace(isoformat=lambda: "t1"), stream_id="u1"),
        SimpleNamespace(event_type="inventory.recon_item_added", payload={"name": "detail", "cost_cents": 200}, occurred_at=SimpleNamespace(isoformat=lambda: "t2"), stream_id="u1"),
        SimpleNamespace(event_type="inventory.recon_item_added", payload={"name": "tires", "cost_cents": 300}, occurred_at=SimpleNamespace(isoformat=lambda: "t3"), stream_id="u1"),
    ]
    out = project_inventory_unit(events)  # type: ignore[arg-type]
    assert out["total_recon_cents"] == 500
    assert out["total_cost_cents"] == 1500


def test_c1_inventory_transition_enforced() -> None:
    db = _FakeDb()
    actor = SimpleNamespace(id="u1")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.modules.inventory.service.get_inventory_doc", lambda **kwargs: SimpleNamespace(document={"state": "acquired"}))
        with pytest.raises(AppError) as exc:
            transition_unit(
                db=db,
                tenant_id="tenant-1",
                actor=actor,
                unit_id="u1",
                to_state="sold",
                reason=None,
                payload={},
            )
    assert exc.value.code == "inventory_transition_invalid"


def test_c1_inventory_transition_api_records_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    audit = {"count": 0}

    def fake_get_db():
        yield _FakeDb()

    monkeypatch.setattr(
        "app.modules.inventory.api.start_idempotent_request",
        lambda **kwargs: SimpleNamespace(record=SimpleNamespace(), replay=None, status_code=None),
    )
    monkeypatch.setattr("app.modules.inventory.api.finalize_idempotent_request", lambda **kwargs: None)
    monkeypatch.setattr(
        "app.modules.inventory.api.transition_unit",
        lambda **kwargs: SimpleNamespace(
            tenant_id="tenant-1",
            doc_type="inventory_unit",
            doc_id="u1",
            version=2,
            updated_at=None,
            document={"state": "recon", "total_recon_cents": 0},
        ),
    )
    monkeypatch.setattr("app.modules.inventory.api.log_audit_event", lambda **kwargs: audit.__setitem__("count", audit["count"] + 1))

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant
    app.dependency_overrides[idempotency_guard] = lambda: None
    client = TestClient(app)
    try:
        r = client.post(
            "/api/v1/inventory/units/u1/transition",
            headers={"X-Tenant-Id": "tenant-1", "Idempotency-Key": "i-k1"},
            json={"to_state": "recon", "payload": {}},
        )
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert audit["count"] == 1


def test_d1_invalid_ro_close_blocked() -> None:
    db = _FakeDb()
    actor = SimpleNamespace(id="u1")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.modules.service_ro.service.get_ro_doc", lambda **kwargs: SimpleNamespace(document={"status": "complete", "total_cents": 0, "payment_status": "unpaid"}))
        with pytest.raises(AppError) as exc:
            append_ro_event(
                db=db,
                tenant_id="tenant-1",
                actor=actor,
                ro_id="ro-1",
                event_type="ro.closed",
                payload={},
            )
    assert exc.value.code == "ro_close_precondition_failed"


def test_d1_valid_ro_close_works() -> None:
    db = _FakeDb()
    actor = SimpleNamespace(id="u1")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.modules.service_ro.service.get_ro_doc", lambda **kwargs: SimpleNamespace(document={"status": "complete", "total_cents": 1000, "payment_status": "paid"}))
        mp.setattr("app.modules.service_ro.service.append_event", lambda **kwargs: None)
        mp.setattr(
            "app.modules.service_ro.service.rebuild_ro_summary",
            lambda **kwargs: SimpleNamespace(
                tenant_id="tenant-1",
                doc_type="ro_summary",
                doc_id="ro-1",
                version=5,
                updated_at=None,
                document={"status": "closed"},
            ),
        )
        mp.setattr("app.modules.service_ro.service.enqueue_outbox", lambda **kwargs: None)
        out = append_ro_event(
            db=db,
            tenant_id="tenant-1",
            actor=actor,
            ro_id="ro-1",
            event_type="ro.closed",
            payload={"closed_at": "now"},
        )
    assert out.document["status"] == "closed"


def test_d1_ro_transition_api_records_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    audit = {"count": 0}

    def fake_get_db():
        yield _FakeDb()

    monkeypatch.setattr(
        "app.modules.service_ro.api.append_ro_event",
        lambda **kwargs: SimpleNamespace(
            tenant_id="tenant-1",
            doc_type="ro_summary",
            doc_id="ro-1",
            version=2,
            updated_at=None,
            document={"status": "authorized"},
        ),
    )
    monkeypatch.setattr("app.modules.service_ro.api.log_audit_event", lambda **kwargs: audit.__setitem__("count", audit["count"] + 1))

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_tenant] = _fake_tenant
    app.dependency_overrides[idempotency_guard] = lambda: None
    client = TestClient(app)
    try:
        r = client.post(
            "/api/v1/service/ros/ro-1/events",
            headers={"X-Tenant-Id": "tenant-1"},
            json={"event_type": "ro.authorized", "payload": {}},
        )
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert audit["count"] == 1


def test_b1_projection_valid_path() -> None:
    events = [
        SimpleNamespace(event_type="deal.created", payload={"deal_id": "d1"}, occurred_at=SimpleNamespace(isoformat=lambda: "t1"), stream_id="d1", version=1),
        SimpleNamespace(event_type="deal.transitioned", payload={"from_state": "quote", "to_state": "penciled", "reason": None, "required_docs": {}}, occurred_at=SimpleNamespace(isoformat=lambda: "t2"), stream_id="d1", version=2),
        SimpleNamespace(event_type="deal.transitioned", payload={"from_state": "penciled", "to_state": "contracted", "reason": None, "required_docs": {"contract_id": "c1"}}, occurred_at=SimpleNamespace(isoformat=lambda: "t3"), stream_id="d1", version=3),
    ]
    out = project_deal_summary(events)  # type: ignore[arg-type]
    assert out["state"] == "contracted"
    assert out["required_docs"]["contract_id"] == "c1"
