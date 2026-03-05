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
    email = f"acct-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(Tenant(id=tenant_id, name=f"ACCT-{suffix}"))
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


def test_accounting_workflow_record_crud_and_ops_state() -> None:
    ctx = _provision()
    try:
        create = ctx.client.post(
            "/api/v1/acct/workflow-records",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "periodId": "2026-03",
                "workflowType": "po_sheet",
                "status": "draft",
                "title": "PO March",
                "referenceNumber": "POSHEE-202603-AAAA",
                "effectiveDate": "2026-03-05",
                "dueDate": "2026-03-20",
                "employeeId": "EMP-1",
                "counterparty": "Vendor Co",
                "notes": "Initial draft",
                "checklist": ["docs", "review"],
                "lineItems": [{"id": "line-1", "label": "Inventory", "glCode": "5000", "quantity": 2, "unitAmount": 150}],
                "taxAmount": 10,
                "commissionRate": 5,
            },
        )
        assert create.status_code == 200, create.text
        created = create.json()
        record_id = created["id"]
        assert created["workflowType"] == "po_sheet"

        listed = ctx.client.get("/api/v1/acct/workflow-records", headers=ctx.headers)
        assert listed.status_code == 200, listed.text
        assert listed.json()["meta"]["total"] >= 1

        updated = ctx.client.put(
            f"/api/v1/acct/workflow-records/{record_id}",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={**created, "status": "in_review", "notes": "Moved to review"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == "in_review"

        ops_get = ctx.client.get("/api/v1/acct/ops/state", headers=ctx.headers)
        assert ops_get.status_code == 200, ops_get.text
        assert ops_get.json()["state"] == {}

        ops_put = ctx.client.put(
            "/api/v1/acct/ops/state",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"state": {"journals": [{"id": "j-1", "status": "draft"}], "auditTrail": []}},
        )
        assert ops_put.status_code == 200, ops_put.text
        assert ops_put.json()["state"]["journals"][0]["id"] == "j-1"

        ops_action = ctx.client.post(
            "/api/v1/acct/ops/actions",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"action": "journal.create", "payload": {"periodId": "2026-03", "memo": "Accrual", "amount": 250, "entryDate": "2026-03-31"}},
        )
        assert ops_action.status_code == 200, ops_action.text
        journals = ops_action.json()["state"]["journals"]
        assert len(journals) >= 1
        assert journals[0]["memo"] == "Accrual"

        deleted = ctx.client.delete(
            f"/api/v1/acct/workflow-records/{record_id}",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
        )
        assert deleted.status_code == 200, deleted.text
        assert deleted.json()["ok"] is True
    finally:
        ctx.client.close()
