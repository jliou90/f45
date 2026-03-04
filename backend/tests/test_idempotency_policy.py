from __future__ import annotations

from app.main import create_app
from fastapi.testclient import TestClient


def test_non_dev_requires_idempotency_header_on_write(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")
    monkeypatch.delenv("KUTM_IDEMPOTENCY_ENFORCE", raising=False)
    app = create_app()
    client = TestClient(app)

    r = client.post("/api/v1/dms/customers", json={"first_name": "A", "last_name": "B"})
    assert r.status_code == 428
    assert r.json()["code"] == "idempotency_required"


def test_dev_does_not_require_idempotency_header_by_default(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.delenv("KUTM_IDEMPOTENCY_ENFORCE", raising=False)
    app = create_app()
    client = TestClient(app)

    r = client.post("/api/v1/dms/customers", json={"first_name": "A", "last_name": "B"})
    assert r.status_code != 428
