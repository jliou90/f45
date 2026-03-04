from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from app.core.mfa import current_totp
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import create_app
from app.modules.integrations.models import OutboxMessage
from app.modules.identity.models import User
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi.testclient import TestClient


@dataclass(frozen=True)
class AuthCtx:
    client: TestClient
    token: str
    tenant_id: str
    email: str
    password: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "X-Tenant-Id": self.tenant_id}


def _provision() -> AuthCtx:
    suffix = uuid4().hex[:8]
    tenant_id = str(uuid4())
    user_id = str(uuid4())
    email = f"maturity-{suffix}@example.com"
    password = "Password123!"
    db = SessionLocal()
    try:
        db.add(Tenant(id=tenant_id, name=f"Maturity-{suffix}"))
        db.add(User(id=user_id, email=email, password_hash=hash_password(password)))
        db.commit()
        tenancy_service.upsert_membership(db, tenant_id=tenant_id, user_id=user_id, role="ADMIN")
    finally:
        db.close()

    client = TestClient(create_app())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return AuthCtx(client=client, token=token, tenant_id=tenant_id, email=email, password=password)


def test_mfa_enrollment_and_login_gate() -> None:
    ctx = _provision()
    try:
        start = ctx.client.post(
            "/api/v1/auth/mfa/enroll/start",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
        )
        assert start.status_code == 200, start.text
        secret = start.json()["secret"]
        code = current_totp(secret)
        verify = ctx.client.post(
            "/api/v1/auth/mfa/enroll/verify",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"otp_code": code},
        )
        assert verify.status_code == 200, verify.text
        no_otp = ctx.client.post("/api/v1/auth/login", json={"email": ctx.email, "password": ctx.password})
        assert no_otp.status_code == 401
        assert no_otp.json()["code"] == "auth_mfa_required"
        with_otp = ctx.client.post(
            "/api/v1/auth/login",
            json={"email": ctx.email, "password": ctx.password, "otp_code": current_totp(secret)},
        )
        assert with_otp.status_code == 200, with_otp.text
    finally:
        ctx.client.close()


def test_customer_email_is_logged_and_queryable() -> None:
    ctx = _provision()
    try:
        create_customer = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Maya", "last_name": "Rivera", "email": "maya@example.com"},
        )
        assert create_customer.status_code == 200, create_customer.text
        customer_id = create_customer.json()["id"]

        sent = ctx.client.post(
            f"/api/v1/comms/customers/{customer_id}/email",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"to_email": "maya@example.com", "subject": "Follow up", "body": "Reached out to customer."},
        )
        assert sent.status_code == 200, sent.text
        assert sent.json()["status"] in {"sent", "failed"}

        listed = ctx.client.get(f"/api/v1/comms/customers/{customer_id}", headers=ctx.headers)
        assert listed.status_code == 200, listed.text
        assert listed.json()["meta"]["total"] >= 1
    finally:
        ctx.client.close()


def test_stip_send_and_procurement_and_scheduler_notifications() -> None:
    ctx = _provision()
    try:
        upload = ctx.client.post(
            "/api/v1/docs/attachments/upload",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            files={"file": ("stip.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert upload.status_code == 200, upload.text
        attachment_id = upload.json()["id"]

        create_deal = ctx.client.post(
            "/api/v1/funding/deals",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"deal_id": "deal-maturity", "customer_name": "Alice", "vehicle": "2026 Sedan"},
        )
        assert create_deal.status_code == 200, create_deal.text

        stip = ctx.client.post(
            "/api/v1/comms/funding/deal-maturity/stip",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "lender_email": "funder@example.com",
                "stip_name": "bank stip insurance",
                "attachment_id": attachment_id,
            },
        )
        assert stip.status_code == 200, stip.text
        assert stip.json()["status"] in {"sent", "failed"}

        supply = ctx.client.post(
            "/api/v1/inventory/supplies",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "sku": "TF-001",
                "name": "Transmission Fluid",
                "on_hand_qty": 2,
                "reorder_point": 5,
                "reorder_qty": 12,
            },
        )
        assert supply.status_code == 200, supply.text
        supply_id = supply.json()["id"]
        assert supply.json()["low_stock"] is True

        batch = ctx.client.post(
            "/api/v1/inventory/order-batches",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"name": "Afternoon Parts Batch"},
        )
        assert batch.status_code == 200, batch.text
        batch_id = batch.json()["id"]
        add_line = ctx.client.put(
            f"/api/v1/inventory/order-batches/{batch_id}/lines",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"supply_item_id": supply_id, "qty": 12},
        )
        assert add_line.status_code == 200, add_line.text
        assert len(add_line.json()["lines"]) >= 1

        customer = ctx.client.post(
            "/api/v1/dms/customers",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"first_name": "Tina", "last_name": "Tech"},
        )
        assert customer.status_code == 200
        customer_id = customer.json()["id"]

        before_count = 0
        db = SessionLocal()
        try:
            before_count = int(
                db.query(OutboxMessage)
                .filter(OutboxMessage.tenant_id == ctx.tenant_id, OutboxMessage.topic.like("appointments.%"))
                .count()
            )
        finally:
            db.close()

        me_id = ctx.client.get("/api/v1/auth/me", headers=ctx.headers).json()["id"]
        appt = ctx.client.post(
            "/api/v1/dms/appointments",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={
                "customer_id": customer_id,
                "scheduled_start": "2026-03-05T08:00:00Z",
                "scheduled_end": "2026-03-05T09:00:00Z",
                "technician_user_id": me_id,
                "service_advisor_user_id": me_id,
            },
        )
        assert appt.status_code == 200, appt.text
        appt_id = appt.json()["id"]

        patched = ctx.client.patch(
            f"/api/v1/dms/appointments/{appt_id}",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4()), "If-Match": f"\"{appt.json()['version']}\""},
            json={"scheduled_start": "2026-03-05T15:00:00Z", "scheduled_end": "2026-03-05T16:00:00Z"},
        )
        assert patched.status_code == 200, patched.text

        db = SessionLocal()
        try:
            after_count = int(
                db.query(OutboxMessage)
                .filter(OutboxMessage.tenant_id == ctx.tenant_id, OutboxMessage.topic.like("appointments.%"))
                .count()
            )
        finally:
            db.close()
        assert after_count > before_count

        avail = ctx.client.get("/api/v1/dms/availability/technicians", headers=ctx.headers, params={"day": "2026-03-05"})
        assert avail.status_code == 200, avail.text
    finally:
        ctx.client.close()


def test_io_export_supports_xlsx_and_pdf() -> None:
    ctx = _provision()
    try:
        created = ctx.client.post(
            "/api/v1/docs/test_docs",
            headers={**ctx.headers, "Idempotency-Key": str(uuid4())},
            json={"data": {"alpha": 1, "beta": "two"}},
        )
        assert created.status_code == 200, created.text

        xlsx = ctx.client.get("/api/v1/io/export/test_docs", headers=ctx.headers, params={"fmt": "xlsx"})
        assert xlsx.status_code == 200
        assert xlsx.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        assert len(xlsx.content) > 100

        pdf = ctx.client.get(
            "/api/v1/io/export/test_docs",
            headers=ctx.headers,
            params={"fmt": "pdf", "orientation": "landscape", "scale": 140},
        )
        assert pdf.status_code == 200
        assert pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content.startswith(b"%PDF")
    finally:
        ctx.client.close()
