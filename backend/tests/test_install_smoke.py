from __future__ import annotations

from uuid import uuid4

from app.core.config import settings
from app.main import create_app
from fastapi.testclient import TestClient


def test_install_smoke_bootstrap_login_tenant_domain_flow() -> None:
    original_bootstrap_token = settings.bootstrap_token
    settings.bootstrap_token = "install-smoke-bootstrap-token"
    tenant_name = f"install-smoke-{uuid4().hex[:8]}"
    email = f"install-smoke-{uuid4().hex[:8]}@example.com"
    password = "Password123!"

    client = TestClient(create_app())
    try:
        bootstrap = client.post(
            "/api/v1/ops/bootstrap",
            headers={"X-Bootstrap-Token": settings.bootstrap_token},
            json={
                "email": email,
                "password": password,
                "tenant_name": tenant_name,
            },
        )
        assert bootstrap.status_code == 200, bootstrap.text
        tenant_id = bootstrap.json()["tenant_id"]

        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

        common_headers = {
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": tenant_id,
        }

        mine = client.get("/api/v1/tenants/mine", headers={"Authorization": f"Bearer {token}"})
        assert mine.status_code == 200, mine.text
        mine_items = mine.json().get("items", [])
        assert any(item["id"] == tenant_id for item in mine_items)

        tenant_scoped = client.get("/api/v1/ops/diag", headers=common_headers)
        assert tenant_scoped.status_code == 200, tenant_scoped.text

        deal_id = str(uuid4())
        domain_create = client.post(
            "/api/v1/deals",
            headers={**common_headers, "Idempotency-Key": f"install-smoke-deal-{deal_id}"},
            json={
                "deal_id": deal_id,
                "customer_id": "install-customer",
                "vehicle_id": "install-vehicle",
                "quote_amount_cents": 123400,
            },
        )
        assert domain_create.status_code == 200, domain_create.text
        assert domain_create.json()["doc_id"] == deal_id
    finally:
        client.close()
        settings.bootstrap_token = original_bootstrap_token
