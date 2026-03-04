from __future__ import annotations

from types import SimpleNamespace

from app.core.auth.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.audit.models import AuditEvent
from app.modules.dms.models import Customer
from app.modules.identity.models import User
from app.modules.tenancy.models import Membership, Tenant
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build_test_db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Tenant.__table__.create(bind=engine)
    User.__table__.create(bind=engine)
    Membership.__table__.create(bind=engine)
    Customer.__table__.create(bind=engine)
    AuditEvent.__table__.create(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    return engine, SessionLocal


def _assert_error_envelope(payload: dict) -> None:
    assert {"code", "message", "details", "request_id"}.issubset(payload.keys())
    assert payload["request_id"] is None or isinstance(payload["request_id"], str)


def test_write_action_creates_audit_event_with_request_and_actor() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add_all(
            [
                Tenant(id="tenant-a", name="Tenant A"),
                User(id="user-1", email="u@example.com", password_hash="x"),
                Membership(tenant_id="tenant-a", user_id="user-1", role="admin"),
            ]
        )
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    def _fake_user():
        return SimpleNamespace(id="user-1")

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/dms/customers",
                headers={"X-Tenant-Id": "tenant-a", "X-Request-Id": "req-a4-001"},
                json={"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com"},
            )
            assert resp.status_code == 200
            created_customer_id = resp.json()["id"]

        with SessionLocal() as db:
            evt = (
                db.query(AuditEvent)
                .filter(
                    AuditEvent.tenant_id == "tenant-a",
                    AuditEvent.entity_type == "customer",
                    AuditEvent.entity_id == created_customer_id,
                    AuditEvent.action == "dms.customer.create",
                )
                .one_or_none()
            )
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert evt is not None
    assert evt.actor_id == "user-1"
    assert evt.request_id == "req-a4-001"


def test_audit_query_returns_pageresult_with_filters() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add_all(
            [
                Tenant(id="tenant-a", name="Tenant A"),
                User(id="user-1", email="u@example.com", password_hash="x"),
                Membership(tenant_id="tenant-a", user_id="user-1", role="admin"),
                AuditEvent(
                    id="evt-1",
                    tenant_id="tenant-a",
                    actor_id="user-1",
                    action="dms.customer.create",
                    entity_type="customer",
                    entity_id="cust-1",
                    request_id="req-1",
                    metadata_json={"source": "test"},
                ),
                AuditEvent(
                    id="evt-2",
                    tenant_id="tenant-a",
                    actor_id="user-1",
                    action="funding.deal.create",
                    entity_type="funding_deal",
                    entity_id="deal-1",
                    request_id="req-2",
                    metadata_json={"source": "test"},
                ),
            ]
        )
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    def _fake_user():
        return SimpleNamespace(id="user-1")

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        with TestClient(app) as client:
            resp = client.get(
                "/api/v1/audit/events",
                headers={"X-Tenant-Id": "tenant-a"},
                params={
                    "entity_type": "customer",
                    "entity_id": "cust-1",
                    "actor_id": "user-1",
                    "action": "dms.customer.create",
                    "page": 1,
                    "size": 20,
                },
            )
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"items", "meta"}
    assert body["meta"]["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == "evt-1"


def test_cross_tenant_audit_event_access_returns_404() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add_all(
            [
                Tenant(id="tenant-a", name="Tenant A"),
                Tenant(id="tenant-b", name="Tenant B"),
                User(id="user-1", email="u@example.com", password_hash="x"),
                Membership(tenant_id="tenant-b", user_id="user-1", role="admin"),
                AuditEvent(
                    id="evt-a",
                    tenant_id="tenant-a",
                    actor_id="user-1",
                    action="dms.customer.create",
                    entity_type="customer",
                    entity_id="cust-a",
                    request_id="req-a",
                    metadata_json={},
                ),
            ]
        )
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    def _fake_user():
        return SimpleNamespace(id="user-1")

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/audit/events/evt-a", headers={"X-Tenant-Id": "tenant-b"})
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert resp.status_code == 404
    body = resp.json()
    _assert_error_envelope(body)
    assert body["code"] == "audit_event_not_found"
