from __future__ import annotations

from app.main import create_app
from fastapi.testclient import TestClient


def test_ops_health_endpoint() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/api/v1/ops/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
