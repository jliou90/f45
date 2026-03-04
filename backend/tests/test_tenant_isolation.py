from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


@dataclass(frozen=True)
class AuthTenantContext:
    client: TestClient
    token: str
    tenant_a: str
    tenant_b: str

    def headers(self, tenant_id: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Tenant-Id": tenant_id,
        }


def _provision_dual_tenant_context() -> AuthTenantContext:
    suffix = uuid4().hex[:10]
    user_id = str(uuid4())
    tenant_a = str(uuid4())
    tenant_b = str(uuid4())
    email = f"isolation-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.add(Tenant(id=tenant_a, name=f"iso-a-{suffix}"))
        db.add(Tenant(id=tenant_b, name=f"iso-b-{suffix}"))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_a, user_id=user_id, role="ADMIN")
        tenancy_service.upsert_membership(db, tenant_id=tenant_b, user_id=user_id, role="ADMIN")
    finally:
        db.close()

    client = TestClient(create_app())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return AuthTenantContext(client=client, token=token, tenant_a=tenant_a, tenant_b=tenant_b)


def test_dms_customer_cross_tenant_read_update_delete_rejected() -> None:
    ctx = _provision_dual_tenant_context()
    try:
        create = ctx.client.post(
            "/api/v1/dms/customers",
            headers=ctx.headers(ctx.tenant_a),
            json={"first_name": "Tenant", "last_name": "A"},
        )
        assert create.status_code == 200, create.text
        customer_id = create.json()["id"]

        cross_get = ctx.client.get(
            f"/api/v1/dms/customers/{customer_id}",
            headers=ctx.headers(ctx.tenant_b),
        )
        assert cross_get.status_code in {403, 404}, cross_get.text

        cross_patch = ctx.client.patch(
            f"/api/v1/dms/customers/{customer_id}",
            headers=ctx.headers(ctx.tenant_b),
            json={"first_name": "Blocked"},
        )
        assert cross_patch.status_code in {403, 404}, cross_patch.text

        cross_delete = ctx.client.delete(
            f"/api/v1/dms/customers/{customer_id}",
            headers=ctx.headers(ctx.tenant_b),
        )
        assert cross_delete.status_code in {403, 404}, cross_delete.text
    finally:
        ctx.client.close()


def test_inventory_cross_tenant_read_and_mutation_rejected() -> None:
    ctx = _provision_dual_tenant_context()
    try:
        unit_id = str(uuid4())
        create = ctx.client.post(
            "/api/v1/inventory/units",
            headers={**ctx.headers(ctx.tenant_a), "Idempotency-Key": f"iso-inv-create-{unit_id}"},
            json={
                "unit_id": unit_id,
                "vehicle_id": "veh-iso",
                "vin": "VINISO12345678901",
                "acquired_cost_cents": 500000,
            },
        )
        assert create.status_code == 200, create.text

        cross_get = ctx.client.get(
            f"/api/v1/inventory/units/{unit_id}",
            headers=ctx.headers(ctx.tenant_b),
        )
        assert cross_get.status_code in {403, 404}, cross_get.text

        cross_transition = ctx.client.post(
            f"/api/v1/inventory/units/{unit_id}/transition",
            headers={**ctx.headers(ctx.tenant_b), "Idempotency-Key": f"iso-inv-transition-{unit_id}"},
            json={"to_state": "recon", "payload": {}},
        )
        assert cross_transition.status_code in {403, 404}, cross_transition.text
    finally:
        ctx.client.close()


def test_deals_cross_tenant_read_and_transition_rejected() -> None:
    ctx = _provision_dual_tenant_context()
    try:
        deal_id = str(uuid4())
        create = ctx.client.post(
            "/api/v1/deals",
            headers={**ctx.headers(ctx.tenant_a), "Idempotency-Key": f"iso-deal-create-{deal_id}"},
            json={
                "deal_id": deal_id,
                "customer_id": "cust-iso",
                "vehicle_id": "veh-iso",
                "quote_amount_cents": 777000,
            },
        )
        assert create.status_code == 200, create.text

        cross_get = ctx.client.get(
            f"/api/v1/deals/{deal_id}",
            headers=ctx.headers(ctx.tenant_b),
        )
        assert cross_get.status_code in {403, 404}, cross_get.text

        cross_transition = ctx.client.post(
            f"/api/v1/deals/{deal_id}/transition",
            headers={**ctx.headers(ctx.tenant_b), "Idempotency-Key": f"iso-deal-transition-{deal_id}"},
            json={"to_state": "penciled", "payload": {}},
        )
        assert cross_transition.status_code in {403, 404}, cross_transition.text
    finally:
        ctx.client.close()


def test_dms_customer_list_is_tenant_scoped() -> None:
    ctx = _provision_dual_tenant_context()
    try:
        create_a = ctx.client.post(
            "/api/v1/dms/customers",
            headers=ctx.headers(ctx.tenant_a),
            json={"first_name": "Scoped", "last_name": "A"},
        )
        assert create_a.status_code == 200, create_a.text
        customer_a_id = create_a.json()["id"]

        create_b = ctx.client.post(
            "/api/v1/dms/customers",
            headers=ctx.headers(ctx.tenant_b),
            json={"first_name": "Scoped", "last_name": "B"},
        )
        assert create_b.status_code == 200, create_b.text
        customer_b_id = create_b.json()["id"]

        list_a = ctx.client.get("/api/v1/dms/customers", headers=ctx.headers(ctx.tenant_a))
        assert list_a.status_code == 200, list_a.text
        ids_a = {item["id"] for item in list_a.json()["items"]}
        assert customer_a_id in ids_a
        assert customer_b_id not in ids_a

        list_b = ctx.client.get("/api/v1/dms/customers", headers=ctx.headers(ctx.tenant_b))
        assert list_b.status_code == 200, list_b.text
        ids_b = {item["id"] for item in list_b.json()["items"]}
        assert customer_b_id in ids_b
        assert customer_a_id not in ids_b
    finally:
        ctx.client.close()


def test_dms_appointment_cross_tenant_get_rejected() -> None:
    ctx = _provision_dual_tenant_context()
    try:
        create_customer = ctx.client.post(
            "/api/v1/dms/customers",
            headers=ctx.headers(ctx.tenant_a),
            json={"first_name": "Appt", "last_name": "Owner"},
        )
        assert create_customer.status_code == 200, create_customer.text
        customer_id = create_customer.json()["id"]

        create_appt = ctx.client.post(
            "/api/v1/dms/appointments",
            headers=ctx.headers(ctx.tenant_a),
            json={
                "customer_id": customer_id,
                "scheduled_start": "2026-01-01T09:00:00Z",
                "notes": "cross-tenant check",
            },
        )
        assert create_appt.status_code == 200, create_appt.text
        appointment_id = create_appt.json()["id"]

        cross_get = ctx.client.get(
            f"/api/v1/dms/appointments/{appointment_id}",
            headers=ctx.headers(ctx.tenant_b),
        )
        assert cross_get.status_code in {403, 404}, cross_get.text
    finally:
        ctx.client.close()
