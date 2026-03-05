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
class AuthCtx:
    client: TestClient
    token: str
    tenant_id: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "X-Tenant-Id": self.tenant_id}


def _provision() -> AuthCtx:
    suffix = uuid4().hex[:8]
    tenant_id = str(uuid4())
    user_id = str(uuid4())
    email = f"portal-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(Tenant(id=tenant_id, name=f"PORTAL-{suffix}"))
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role="ADMIN")
    finally:
        db.close()

    client = TestClient(create_app())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return AuthCtx(client=client, token=token, tenant_id=tenant_id)


def test_portal_search_returns_customer_and_accounting_matches() -> None:
    ctx = _provision()
    try:
        customer = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Riley", "last_name": "Gray", "email": "riley@example.com"},
        )
        assert customer.status_code == 200, customer.text
        customer_id = customer.json()["id"]

        crm = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "dms_customer_id": "CUST-GRAY-20260305-QWER",
                "spouse": {"first_name": "Jamie", "last_name": "Gray", "phone": "", "email": "", "notes": ""},
                "household": {"household_id": "HH-2201", "relationship": "Primary", "linked_customer_ids": []},
                "phones": [],
                "emails": [],
                "garage": [],
                "notes": [],
                "communications": [],
                "tasks": [],
                "attachments": [],
            },
        )
        assert crm.status_code == 200, crm.text

        record = ctx.client.post(
            "/api/v1/acct/workflow-records",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "periodId": "2026-03",
                "workflowType": "po_sheet",
                "status": "in_review",
                "title": "Riley Gray Deal Jacket",
                "referenceNumber": "POSHEE-202603-RILEY",
                "effectiveDate": "2026-03-05",
                "dueDate": "2026-03-20",
                "employeeId": "EMP-4",
                "counterparty": "Vendor Co",
                "notes": "Review for Riley",
                "checklist": [],
                "lineItems": [{"id": "line-1", "label": "Fee", "glCode": "5000", "quantity": 1, "unitAmount": 100}],
                "taxAmount": 0,
                "commissionRate": 0,
            },
        )
        assert record.status_code == 200, record.text

        search = ctx.client.get("/api/v1/portal/search?q=Riley", headers=ctx.headers)
        assert search.status_code == 200, search.text
        body = search.json()
        assert body["facets"]["customers"] >= 1
        assert body["facets"]["accounting"] >= 1
        modules = {item["module"] for item in body["items"]}
        assert "customers" in modules
        assert "accounting" in modules
    finally:
        ctx.client.close()


def test_action_center_prefs_and_role_queue_modes() -> None:
    ctx = _provision()
    try:
        customer = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Casey", "last_name": "Moon", "email": "casey@example.com"},
        )
        assert customer.status_code == 200, customer.text
        customer_id = customer.json()["id"]

        crm = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "dms_customer_id": "CUST-MOON-20260305-ASDF",
                "spouse": {"first_name": "", "last_name": "", "phone": "", "email": "", "notes": ""},
                "household": {"household_id": "", "relationship": "", "linked_customer_ids": []},
                "phones": [],
                "emails": [],
                "garage": [],
                "notes": [],
                "communications": [],
                "tasks": [{"id": "task-1", "title": "Call customer", "due_at": "2026-03-01T12:00:00Z", "status": "open", "owner": "", "notes": ""}],
                "attachments": [],
            },
        )
        assert crm.status_code == 200, crm.text

        ops_state = ctx.client.put(
            "/api/v1/acct/ops/state",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "state": {
                    "approvals": [{"id": "appr-1", "area": "period_close", "entityId": "2026-03", "status": "pending"}],
                    "roExceptions": [{"id": "ro-1", "roId": "RO-10", "reason": "Mismatch", "resolved": False}],
                    "journals": [],
                    "vendorInvoices": [],
                    "receivables": [],
                    "dealFunding": [],
                    "commissions": [],
                    "taxFilings": [],
                    "reconciliations": [],
                    "assets": [],
                    "periodControls": [],
                    "auditTrail": [],
                }
            },
        )
        assert ops_state.status_code == 200, ops_state.text

        put_prefs = ctx.client.put(
            "/api/v1/portal/prefs/action-center",
            headers=ctx.headers,
            json={
                "saved_views": [
                    {
                        "id": "view-1",
                        "name": "Morning Ops",
                        "query": "casey",
                        "modules": ["customers", "accounting"],
                        "teams": ["ops"],
                        "updated_at": "2026-03-05T01:00:00Z",
                    }
                ],
                "default_view_id": "view-1",
                "team_queue_mode": "accounting",
                "role_queue_overrides": {"ADMIN": "hybrid"},
            },
        )
        assert put_prefs.status_code == 200, put_prefs.text
        assert put_prefs.json()["default_view_id"] == "view-1"

        queue = ctx.client.get("/api/v1/portal/action-center/queue?mode=hybrid", headers=ctx.headers)
        assert queue.status_code == 200, queue.text
        payload = queue.json()
        assert payload["team_mode"] == "hybrid"
        assert payload["summary"]["customer_tasks"] >= 1
        assert payload["summary"]["accounting_approvals"] >= 1
        assert payload["summary"]["accounting_exceptions"] >= 1
    finally:
        ctx.client.close()
