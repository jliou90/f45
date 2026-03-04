from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.admin import service as admin_service
from app.modules.admin.models import (
    FeatureFlag,
    InviteToken,
    PasswordResetToken,
    RoleFeatureOverride,
    TenantFeatureOverride,
    TenantProfile,
    UserFeatureOverride,
)
from app.modules.audit.models import AuditEvent
from app.modules.identity.models import RefreshToken, User
from app.modules.rbac.models import PermissionGrant, Role, RolePermission
from app.modules.rbac.service import ensure_default_admin_role, seed_permission_catalog
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
    Role.__table__.create(bind=engine)
    PermissionGrant.__table__.create(bind=engine)
    RolePermission.__table__.create(bind=engine)
    Membership.__table__.create(bind=engine)
    RefreshToken.__table__.create(bind=engine)
    AuditEvent.__table__.create(bind=engine)
    InviteToken.__table__.create(bind=engine)
    PasswordResetToken.__table__.create(bind=engine)
    FeatureFlag.__table__.create(bind=engine)
    TenantFeatureOverride.__table__.create(bind=engine)
    RoleFeatureOverride.__table__.create(bind=engine)
    UserFeatureOverride.__table__.create(bind=engine)
    TenantProfile.__table__.create(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    return engine, SessionLocal


def _headers(tenant_id: str) -> dict[str, str]:
    return {"X-Tenant-Id": tenant_id}


def _headers_with_idmp(tenant_id: str) -> dict[str, str]:
    return {"X-Tenant-Id": tenant_id, "Idempotency-Key": str(uuid4())}


def _seed_admin_actor(db, *, tenant_id: str, user_id: str, email: str = "admin@example.com") -> Role:
    seed_permission_catalog(db)
    user = User(id=user_id, email=email, password_hash="hash", is_active=True, is_disabled=False)
    db.add(user)
    role = ensure_default_admin_role(db, tenant_id=tenant_id)
    db.add(Membership(tenant_id=tenant_id, user_id=user_id, role_id=role.id, role="ADMIN"))
    db.flush()
    return role


def test_admin_requires_auth_and_permission() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        db.add(User(id="member-1", email="member@example.com", password_hash="hash", is_active=True, is_disabled=False))
        db.add(Membership(tenant_id="tenant-a", user_id="member-1", role="USER"))
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    try:
        with TestClient(app) as client:
            unauth = client.get("/api/v1/admin/users", headers=_headers("tenant-a"))
            assert unauth.status_code == 401
            assert unauth.json()["code"] == "auth_missing"
            assert unauth.headers.get("x-request-id")

            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="member-1")
            forbidden = client.get("/api/v1/admin/users", headers=_headers("tenant-a"))
            assert forbidden.status_code == 403
            assert forbidden.json()["code"] == "permission_denied"
            assert forbidden.headers.get("x-request-id")
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_admin_tenant_isolation_for_users() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add_all([Tenant(id="tenant-a", name="Tenant A"), Tenant(id="tenant-b", name="Tenant B")])
        _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a", email="admin-a@example.com")
        role_b = ensure_default_admin_role(db, tenant_id="tenant-b")
        user_b = User(id="user-b", email="user-b@example.com", password_hash="hash", is_active=True, is_disabled=False)
        db.add(user_b)
        db.add(Membership(tenant_id="tenant-b", user_id="user-b", role_id=role_b.id, role="ADMIN"))
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/admin/users", headers=_headers("tenant-a"))
            assert resp.status_code == 200
            body = resp.json()
            assert body["meta"]["total"] == 1
            assert body["items"][0]["email"] == "admin-a@example.com"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_cannot_disable_last_admin_equivalent() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            resp = client.delete("/api/v1/admin/users/admin-a", headers=_headers("tenant-a"))
            assert resp.status_code == 422
            body = resp.json()
            assert body["code"] == "last_admin_protection"
            assert body["request_id"] == resp.headers.get("x-request-id")
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_admin_user_happy_path_with_audit_and_request_id() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        admin_role = _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        manager_role = Role(
            id=str(uuid4()),
            tenant_id="tenant-a",
            name="MANAGER",
            description="Manager",
        )
        db.add(manager_role)
        db.flush()
        db.add(RolePermission(role_id=manager_role.id, permission_key="admin.users.read"))
        db.commit()
        _ = admin_role

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            roles = client.get("/api/v1/admin/roles", headers=_headers("tenant-a"))
            assert roles.status_code == 200
            manager = [r for r in roles.json()["items"] if r["name"] == "MANAGER"][0]

            created = client.post(
                "/api/v1/admin/users",
                headers=_headers("tenant-a"),
                json={
                    "email": "new.user@example.com",
                    "display_name": "New User",
                    "role_id": manager["id"],
                },
            )
            assert created.status_code == 200
            created_body = created.json()
            user_id = created_body["id"]
            assert created_body["request_id"] == created.headers.get("x-request-id")

            listed = client.get("/api/v1/admin/users", headers=_headers("tenant-a"), params={"query": "new.user"})
            assert listed.status_code == 200
            assert listed.json()["meta"]["total"] == 1

            updated = client.put(
                f"/api/v1/admin/users/{user_id}",
                headers=_headers("tenant-a"),
                json={"display_name": "Updated User", "is_active": True},
            )
            assert updated.status_code == 200
            assert updated.json()["display_name"] == "Updated User"

            disabled = client.delete(f"/api/v1/admin/users/{user_id}", headers=_headers("tenant-a"))
            assert disabled.status_code == 200
            assert disabled.json()["ok"] is True

            audit = client.get("/api/v1/admin/audit", headers=_headers("tenant-a"), params={"actor": "admin-a"})
            assert audit.status_code == 200
            actions = {item["action"] for item in audit.json()["items"]}
            assert "user.create" in actions
            assert "user.update" in actions
            assert "user.disable" in actions
            assert audit.headers.get("x-request-id")
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_invite_create_and_accept_creates_membership_and_audit() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        manager = Role(id=str(uuid4()), tenant_id="tenant-a", name="MANAGER", description="Manager")
        db.add(manager)
        _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        db.commit()
        manager_id = manager.id

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            created = client.post(
                "/api/v1/admin/invites",
                headers=_headers_with_idmp("tenant-a"),
                json={"email": "invited@example.com", "display_name": "Invited", "role_id": manager_id, "expires_in_days": 7},
            )
            assert created.status_code == 200
            payload = created.json()
            assert payload["invite_id"]
            assert created.headers.get("x-request-id")
            link = payload.get("invite_link")
            assert isinstance(link, str) and "token=" in link
            token = link.split("token=", 1)[1]

            accepted = client.post(
                "/api/v1/auth/accept-invite",
                headers={"Idempotency-Key": str(uuid4())},
                json={"token": token, "password": "StrongerPass123!", "display_name": "Invited Person"},
            )
            assert accepted.status_code == 200
            assert accepted.json()["ok"] is True

        with SessionLocal() as db:
            user = db.query(User).filter(User.email == "invited@example.com").one_or_none()
            assert user is not None
            membership = db.get(Membership, {"tenant_id": "tenant-a", "user_id": user.id})
            assert membership is not None
            actions = {row[0] for row in db.query(AuditEvent.action).filter(AuditEvent.tenant_id == "tenant-a").all()}
            assert "invite.create" in actions
            assert "invite.accept" in actions
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_password_reset_token_created_and_token_redacted_from_audit() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        admin_role = _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        user = User(id="user-1", email="user1@example.com", password_hash="hash", is_active=True, is_disabled=False)
        db.add(user)
        db.add(Membership(tenant_id="tenant-a", user_id="user-1", role_id=admin_role.id, role="ADMIN"))
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            reset = client.post("/api/v1/admin/users/user-1/password-reset", headers=_headers_with_idmp("tenant-a"))
            assert reset.status_code == 200
            body = reset.json()
            link = body.get("link")
            assert body["ok"] is True
            token = link.split("token=", 1)[1] if isinstance(link, str) and "token=" in link else None

        with SessionLocal() as db:
            event = (
                db.query(AuditEvent)
                .filter(AuditEvent.tenant_id == "tenant-a", AuditEvent.action == "user.password_reset.create")
                .order_by(AuditEvent.ts.desc())
                .first()
            )
            assert event is not None
            metadata = event.metadata_json or {}
            assert metadata.get("token") == "***REDACTED***"
            if token:
                assert token not in str(metadata)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_sessions_endpoints_are_rbac_gated() -> None:
    engine, SessionLocal = _build_test_db()
    now = datetime.now(UTC)
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        admin_role = _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        target = User(id="target-1", email="target@example.com", password_hash="hash", is_active=True, is_disabled=False)
        viewer = User(id="viewer-1", email="viewer@example.com", password_hash="hash", is_active=True, is_disabled=False)
        db.add_all([target, viewer])
        db.add(Membership(tenant_id="tenant-a", user_id="target-1", role_id=admin_role.id, role="ADMIN"))
        db.add(Membership(tenant_id="tenant-a", user_id="viewer-1", role="USER"))
        db.add(
            RefreshToken(
                id="sess-1",
                user_id="target-1",
                jti_hash="jti-hash",
                expires_at=now + timedelta(days=1),
                last_seen_at=now,
            )
        )
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    try:
        with TestClient(app) as client:
            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="viewer-1")
            forbidden = client.get("/api/v1/admin/users/target-1/sessions", headers=_headers("tenant-a"))
            assert forbidden.status_code == 403
            assert forbidden.json()["code"] == "permission_denied"

            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
            allowed = client.get("/api/v1/admin/users/target-1/sessions", headers=_headers("tenant-a"))
            assert allowed.status_code == 200
            assert allowed.json()["meta"]["total"] == 1
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_feature_flag_resolution_order_user_role_tenant_default() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        manager = Role(id=str(uuid4()), tenant_id="tenant-a", name="MANAGER", description="Manager")
        db.add(manager)
        db.flush()
        membership = db.get(Membership, {"tenant_id": "tenant-a", "user_id": "admin-a"})
        assert membership is not None
        membership.role_id = manager.id
        membership.role = "MANAGER"
        db.add(membership)
        db.add(FeatureFlag(key="diagnostics.enabled", description="Diagnostics", default_value=False))
        db.add(TenantFeatureOverride(id=str(uuid4()), tenant_id="tenant-a", flag_key="diagnostics.enabled", value=True, enabled=True))
        db.add(RoleFeatureOverride(id=str(uuid4()), tenant_id="tenant-a", role_id=manager.id, flag_key="diagnostics.enabled", value=False, enabled=True))
        db.add(UserFeatureOverride(id=str(uuid4()), tenant_id="tenant-a", user_id="admin-a", flag_key="diagnostics.enabled", value=True, enabled=True))
        db.commit()

        resolved = admin_service.resolve_effective_flags(db, tenant_id="tenant-a", user_id="admin-a")
        assert resolved["diagnostics.enabled"] is True
    engine.dispose()


def test_tenant_theme_update_is_scoped_per_tenant() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add_all([Tenant(id="tenant-a", name="Tenant A"), Tenant(id="tenant-b", name="Tenant B")])
        seed_permission_catalog(db)
        user = User(id="admin-a", email="admin-a@example.com", password_hash="hash", is_active=True, is_disabled=False)
        db.add(user)
        role_a = ensure_default_admin_role(db, tenant_id="tenant-a")
        role_b = ensure_default_admin_role(db, tenant_id="tenant-b")
        db.add_all(
            [
                Membership(tenant_id="tenant-a", user_id="admin-a", role_id=role_a.id, role="ADMIN"),
                Membership(tenant_id="tenant-b", user_id="admin-a", role_id=role_b.id, role="ADMIN"),
            ]
        )
        db.commit()

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            updated = client.put(
                "/api/v1/admin/tenant/theme",
                headers=_headers_with_idmp("tenant-a"),
                json={"accent_color": "#112233", "print_header_enabled": True},
            )
            assert updated.status_code == 200
            assert updated.json()["accent_color"] == "#112233"
            assert updated.json()["print_header_enabled"] is True

            tenant_a = client.get("/api/v1/admin/tenant/theme", headers=_headers("tenant-a"))
            tenant_b = client.get("/api/v1/admin/tenant/theme", headers=_headers("tenant-b"))
            assert tenant_a.status_code == 200 and tenant_b.status_code == 200
            assert tenant_a.json()["accent_color"] == "#112233"
            assert tenant_b.json()["accent_color"] != "#112233"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_cannot_remove_admin_users_write_from_last_admin_role_in_use() -> None:
    engine, SessionLocal = _build_test_db()
    with SessionLocal() as db:
        db.add(Tenant(id="tenant-a", name="Tenant A"))
        admin_role = _seed_admin_actor(db, tenant_id="tenant-a", user_id="admin-a")
        db.commit()
        role_id = admin_role.id

    def _override_db():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="admin-a")
    try:
        with TestClient(app) as client:
            resp = client.put(
                f"/api/v1/admin/roles/{role_id}",
                headers=_headers_with_idmp("tenant-a"),
                json={"name": "ADMIN", "description": "admin role", "permissions": ["admin.users.read", "admin.roles.read"]},
            )
            assert resp.status_code == 422
            assert resp.json()["code"] == "last_admin_protection"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
