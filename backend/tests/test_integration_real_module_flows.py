from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

import pytest
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


@dataclass(frozen=True)
class AuthContext:
    client: TestClient
    token: str
    tenant_id: str

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Tenant-Id": self.tenant_id,
        }


def provision_auth_context() -> AuthContext:
    suffix = uuid4().hex[:10]
    tenant_id = str(uuid4())
    user_id = str(uuid4())
    email = f"it-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(Tenant(id=tenant_id, name=f"it-{suffix}"))
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.commit()
        tenancy_service.upsert_membership(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            role="ADMIN",
        )
    finally:
        db.close()

    client = TestClient(create_app())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return AuthContext(client=client, token=token, tenant_id=tenant_id)


@pytest.fixture()
def auth_ctx():
    ctx = provision_auth_context()
    try:
        yield ctx
    finally:
        ctx.client.close()


def test_deals_real_flow_valid_and_invalid_transition(auth_ctx) -> None:
    deal_id = str(uuid4())
    create_resp = auth_ctx.client.post(
        "/api/v1/deals",
        headers={**auth_ctx.headers, "Idempotency-Key": f"deal-create-{deal_id}"},
        json={
            "deal_id": deal_id,
            "customer_id": "cust-it",
            "vehicle_id": "veh-it",
            "quote_amount_cents": 1250000,
        },
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["document"]["state"] == "quote"

    valid_resp = auth_ctx.client.post(
        f"/api/v1/deals/{deal_id}/transition",
        headers={**auth_ctx.headers, "Idempotency-Key": f"deal-transition-{deal_id}-1"},
        json={"to_state": "penciled", "payload": {}},
    )
    assert valid_resp.status_code == 200
    assert valid_resp.json()["document"]["state"] == "penciled"

    invalid_resp = auth_ctx.client.post(
        f"/api/v1/deals/{deal_id}/transition",
        headers={**auth_ctx.headers, "Idempotency-Key": f"deal-transition-{deal_id}-2"},
        json={"to_state": "booked", "payload": {}},
    )
    assert invalid_resp.status_code == 409
    assert invalid_resp.json()["code"] == "deal_transition_invalid"


def test_inventory_real_flow_recon_transition_and_rollup(auth_ctx) -> None:
    unit_id = str(uuid4())
    create_resp = auth_ctx.client.post(
        "/api/v1/inventory/units",
        headers={**auth_ctx.headers, "Idempotency-Key": f"inv-create-{unit_id}"},
        json={
            "unit_id": unit_id,
            "vehicle_id": "veh-inv",
            "vin": "VININTEGRATION123456",
            "acquired_cost_cents": 400000,
        },
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["document"]["state"] == "acquired"

    recon_resp = auth_ctx.client.post(
        f"/api/v1/inventory/units/{unit_id}/recon-items",
        headers={**auth_ctx.headers, "Idempotency-Key": f"inv-recon-{unit_id}"},
        json={"name": "detail", "cost_cents": 12000, "notes": "integration"},
    )
    assert recon_resp.status_code == 200
    assert recon_resp.json()["document"]["total_recon_cents"] == 12000
    assert recon_resp.json()["document"]["total_cost_cents"] == 412000

    to_recon = auth_ctx.client.post(
        f"/api/v1/inventory/units/{unit_id}/transition",
        headers={**auth_ctx.headers, "Idempotency-Key": f"inv-transition-{unit_id}-1"},
        json={"to_state": "recon", "payload": {}},
    )
    assert to_recon.status_code == 200
    assert to_recon.json()["document"]["state"] == "recon"

    to_frontline = auth_ctx.client.post(
        f"/api/v1/inventory/units/{unit_id}/transition",
        headers={**auth_ctx.headers, "Idempotency-Key": f"inv-transition-{unit_id}-2"},
        json={"to_state": "frontline", "payload": {}},
    )
    assert to_frontline.status_code == 200
    assert to_frontline.json()["document"]["state"] == "frontline"

    get_resp = auth_ctx.client.get(
        f"/api/v1/inventory/units/{unit_id}",
        headers=auth_ctx.headers,
    )
    assert get_resp.status_code == 200
    body = get_resp.json()["document"]
    assert body["total_recon_cents"] == 12000
    assert body["total_cost_cents"] == 412000


def test_service_ro_real_flow_close_preconditions_enforced(auth_ctx) -> None:
    ro_id = str(uuid4())
    create_resp = auth_ctx.client.post(
        "/api/v1/service/ros",
        headers=auth_ctx.headers,
        json={
            "ro_id": ro_id,
            "customer_name": "Integration Customer",
            "vehicle": "2025 KUTM",
        },
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["document"]["status"] == "open"

    labor_resp = auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={
            "event_type": "ro.labor_line_added",
            "payload": {
                "description": "diag",
                "hours": 1.5,
                "rate_cents": 10000,
            },
        },
    )
    assert labor_resp.status_code == 200

    part_resp = auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={
            "event_type": "ro.part_line_added",
            "payload": {
                "part_no": "P-1",
                "qty": 1,
                "unit_cents": 5000,
            },
        },
    )
    assert part_resp.status_code == 200

    assert auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.authorized", "payload": {}},
    ).status_code == 200
    assert auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.in_progress", "payload": {}},
    ).status_code == 200
    assert auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.completed", "payload": {}},
    ).status_code == 200

    close_blocked = auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.closed", "payload": {"closed_at": "2026-02-21T00:00:00Z"}},
    )
    assert close_blocked.status_code == 409
    assert close_blocked.json()["code"] == "ro_close_precondition_failed"

    payment_resp = auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.payment_updated", "payload": {"payment_status": "paid"}},
    )
    assert payment_resp.status_code == 200

    close_ok = auth_ctx.client.post(
        f"/api/v1/service/ros/{ro_id}/events",
        headers=auth_ctx.headers,
        json={"event_type": "ro.closed", "payload": {"closed_at": "2026-02-21T00:01:00Z"}},
    )
    assert close_ok.status_code == 200
    assert close_ok.json()["document"]["status"] == "closed"
