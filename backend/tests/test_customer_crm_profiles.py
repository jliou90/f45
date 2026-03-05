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
    email = f"crm-{suffix}@example.com"
    password = "Password123!"

    db = SessionLocal()
    try:
        db.add(Tenant(id=tenant_id, name=f"CRM-{suffix}"))
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


def test_customer_crm_profile_upsert_get_and_list() -> None:
    ctx = _provision()
    try:
        created = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Chris", "last_name": "Miller", "email": "chris@example.com"},
        )
        assert created.status_code == 200, created.text
        customer_id = created.json()["id"]

        upsert = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "dms_customer_id": "CUST-MILL-20260305-ABCD",
                "spouse": {
                    "first_name": "Taylor",
                    "last_name": "Miller",
                    "phone": "312-555-0100",
                    "email": "taylor@example.com",
                    "notes": "Prefers SMS",
                },
                "household": {
                    "household_id": "HH-1001",
                    "relationship": "Primary",
                    "linked_customer_ids": ["cust-spouse-1"],
                },
                "phones": [{"id": "phone-1", "label": "Mobile", "number": "312-555-0199", "primary": True}],
                "emails": [{"id": "email-1", "label": "Work", "email": "cmiller@work.com", "primary": True}],
                "garage": [{"id": "veh-1", "year": "2024", "make": "Ford", "model": "F-150", "vin": "VIN00000000000001", "nickname": "Truck"}],
                "notes": [{"id": "note-1", "text": "VIP customer", "created_at": "2026-03-05T01:00:00Z"}],
                "communications": [
                    {
                        "id": "comm-1",
                        "channel": "phone",
                        "direction": "outbound",
                        "subject": "Follow-up",
                        "summary": "Discussed service plan",
                        "happened_at": "2026-03-05T02:00:00Z",
                    }
                ],
            },
        )
        assert upsert.status_code == 200, upsert.text
        etag = upsert.headers.get("etag")
        assert etag
        body = upsert.json()
        assert body["customer_id"] == customer_id
        assert body["dms_customer_id"] == "CUST-MILL-20260305-ABCD"
        assert body["spouse"]["first_name"] == "Taylor"

        fetched = ctx.client.get(f"/api/v1/dms/customers/{customer_id}/crm", headers=ctx.headers)
        assert fetched.status_code == 200, fetched.text
        assert fetched.json()["household"]["household_id"] == "HH-1001"

        listed = ctx.client.get("/api/v1/dms/customers-crm", headers=ctx.headers)
        assert listed.status_code == 200, listed.text
        assert listed.json()["meta"]["total"] >= 1
        ids = {item["customer_id"] for item in listed.json()["items"]}
        assert customer_id in ids

        stale = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4()), "If-Match": '"0"'},
            json=body,
        )
        assert stale.status_code == 409, stale.text

        update = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4()), "If-Match": etag},
            json={**body, "dms_customer_id": "CUST-MILL-20260305-EFGH"},
        )
        assert update.status_code == 200, update.text
        assert update.json()["dms_customer_id"] == "CUST-MILL-20260305-EFGH"
    finally:
        ctx.client.close()


def test_customer_crm_profile_tenant_isolation() -> None:
    primary = _provision()
    secondary = _provision()
    try:
        created = primary.client.post(
            "/api/v1/dms/customers",
            headers={**primary.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Isolated", "last_name": "Customer"},
        )
        assert created.status_code == 200, created.text
        customer_id = created.json()["id"]

        upsert = primary.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**primary.headers, "Idempotency-Key": str(uuid4())},
            json={"dms_customer_id": "CUST-ISO-1"},
        )
        assert upsert.status_code == 200, upsert.text

        cross_get = secondary.client.get(f"/api/v1/dms/customers/{customer_id}/crm", headers=secondary.headers)
        assert cross_get.status_code in {403, 404}, cross_get.text

        cross_list = secondary.client.get("/api/v1/dms/customers-crm", headers=secondary.headers)
        assert cross_list.status_code == 200, cross_list.text
        ids = {item["customer_id"] for item in cross_list.json()["items"]}
        assert customer_id not in ids
    finally:
        primary.client.close()
        secondary.client.close()


def test_customer_search_includes_crm_fields() -> None:
    ctx = _provision()
    try:
        created = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Jordan", "last_name": "Lee", "email": "jordan@example.com"},
        )
        assert created.status_code == 200, created.text
        customer_id = created.json()["id"]

        upsert = ctx.client.put(
            f"/api/v1/dms/customers/{customer_id}/crm",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "dms_customer_id": "CUST-LEE-20260305-Q1W2",
                "spouse": {
                    "first_name": "Morgan",
                    "last_name": "Lee",
                    "phone": "312-555-8888",
                    "email": "morgan@example.com",
                    "notes": "",
                },
                "household": {
                    "household_id": "HH-9900",
                    "relationship": "Primary",
                    "linked_customer_ids": [],
                },
                "phones": [],
                "emails": [],
                "garage": [],
                "notes": [],
                "communications": [],
                "tasks": [],
                "attachments": [],
            },
        )
        assert upsert.status_code == 200, upsert.text

        search = ctx.client.get("/api/v1/dms/customers/search?q=HH-9900", headers=ctx.headers)
        assert search.status_code == 200, search.text
        rows = search.json()["items"]
        assert any(row["id"] == customer_id for row in rows)

        spouse_search = ctx.client.get("/api/v1/dms/customers/search?q=Morgan", headers=ctx.headers)
        assert spouse_search.status_code == 200, spouse_search.text
        spouse_rows = spouse_search.json()["items"]
        assert any(row["id"] == customer_id for row in spouse_rows)
    finally:
        ctx.client.close()
