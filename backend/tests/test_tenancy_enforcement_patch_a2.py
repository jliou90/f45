from __future__ import annotations

from types import SimpleNamespace

from app.core.auth.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.dms.models import Customer
from app.modules.identity.models import User
from app.modules.tenancy.models import Membership, Tenant
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _assert_error_envelope(payload: dict) -> None:
    assert {"code", "message", "details", "request_id"}.issubset(payload.keys())
    assert isinstance(payload["code"], str)
    assert isinstance(payload["message"], str)
    assert payload["request_id"] is None or isinstance(payload["request_id"], str)


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
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    return engine, SessionLocal


def test_tenant_scoped_endpoint_requires_tenant_context() -> None:
    engine, SessionLocal = _build_test_db()

    def _override_db():
        with SessionLocal() as db:
            yield db

    def _fake_user():
        return SimpleNamespace(id="user-1")

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/dms/customers")
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert resp.status_code == 400
    body = resp.json()
    _assert_error_envelope(body)
    assert body["code"] == "tenant_missing"
    assert body["request_id"] == resp.headers.get("x-request-id")


def test_cross_tenant_read_returns_404_without_leakage() -> None:
    engine, SessionLocal = _build_test_db()

    with SessionLocal() as db:
        db.add_all(
            [
                Tenant(id="tenant-a", name="Tenant A"),
                Tenant(id="tenant-b", name="Tenant B"),
                User(id="user-1", email="u@example.com", password_hash="x"),
                Membership(tenant_id="tenant-a", user_id="user-1", role="admin"),
                Membership(tenant_id="tenant-b", user_id="user-1", role="admin"),
                Customer(id="cust-1", tenant_id="tenant-a", first_name="A", last_name="Only"),
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
            resp = client.get("/api/v1/dms/customers/cust-1", headers={"X-Tenant-Id": "tenant-b"})
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert resp.status_code == 404
    body = resp.json()
    _assert_error_envelope(body)
    assert body["code"] == "customer_not_found"
    assert body["request_id"] == resp.headers.get("x-request-id")


def test_matching_tenant_succeeds_and_payload_tenant_id_is_ignored() -> None:
    engine, SessionLocal = _build_test_db()

    with SessionLocal() as db:
        db.add_all(
            [
                Tenant(id="tenant-a", name="Tenant A"),
                Tenant(id="tenant-b", name="Tenant B"),
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
                headers={"X-Tenant-Id": "tenant-a"},
                json={
                    "tenant_id": "tenant-b",
                    "first_name": "Jane",
                    "last_name": "Doe",
                },
            )
            assert resp.status_code == 200
            body = resp.json()
            created_id = body["id"]

        with SessionLocal() as db:
            row = db.query(Customer).filter(Customer.id == created_id).one()
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert body["tenant_id"] == "tenant-a"
    assert row.tenant_id == "tenant-a"
