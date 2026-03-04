from __future__ import annotations

from uuid import uuid4

from app.core.config import settings
from app.main import create_app
from fastapi.testclient import TestClient


def _require_request_id(response) -> str:
    request_id = response.headers.get("x-request-id") or response.headers.get("X-Request-Id")
    assert request_id, f"missing X-Request-Id header for {response.request.method} {response.request.url}"
    return request_id


def test_e2e_auth_tenant_write_flow_includes_request_id() -> None:
    original_bootstrap_token = settings.bootstrap_token
    settings.bootstrap_token = "e2e-smoke-bootstrap-token"

    tenant_name = f"e2e-smoke-{uuid4().hex[:8]}"
    email = f"e2e-smoke-{uuid4().hex[:8]}@example.com"
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
        _require_request_id(bootstrap)
        tenant_id = bootstrap.json()["tenant_id"]

        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        _require_request_id(login)
        token = login.json()["access_token"]

        mine = client.get("/api/v1/tenants/mine", headers={"Authorization": f"Bearer {token}"})
        assert mine.status_code == 200, mine.text
        _require_request_id(mine)
        mine_items = mine.json().get("items", [])
        assert any(item["id"] == tenant_id for item in mine_items)

        # Error-path contract: tenant-scoped endpoint without tenant header should include request_id in body + header.
        missing_tenant = client.get("/api/v1/ops/diag", headers={"Authorization": f"Bearer {token}"})
        assert missing_tenant.status_code in {400, 401, 403}, missing_tenant.text
        header_request_id = _require_request_id(missing_tenant)
        body = missing_tenant.json()
        err = body.get("error", body)
        assert err.get("request_id") == header_request_id

        common_headers = {
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": tenant_id,
        }
        deal_id = str(uuid4())
        domain_create = client.post(
            "/api/v1/deals",
            headers={**common_headers, "Idempotency-Key": f"e2e-smoke-deal-{deal_id}"},
            json={
                "deal_id": deal_id,
                "customer_id": "e2e-customer",
                "vehicle_id": "e2e-vehicle",
                "quote_amount_cents": 250000,
            },
        )
        assert domain_create.status_code == 200, domain_create.text
        _require_request_id(domain_create)
        assert domain_create.json()["doc_id"] == deal_id
    finally:
        client.close()
        settings.bootstrap_token = original_bootstrap_token
