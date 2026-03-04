from __future__ import annotations

from app.main import create_app
from fastapi.testclient import TestClient


def test_metrics_endpoint_returns_prometheus_text() -> None:
    app = create_app()
    client = TestClient(app)

    # Seed a few requests so metrics have request series.
    client.get("/health", headers={"X-Request-Id": "req-metrics-1"})
    client.get("/healthz", headers={"X-Request-Id": "req-metrics-2"})

    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in (resp.headers.get("content-type") or "")
    body = resp.text
    assert "kutm_http_requests_total" in body
    assert "kutm_http_request_duration_ms_bucket" in body
    assert "kutm_http_errors_total" in body
    assert 'path="/health"' in body


def test_ops_metrics_alias_is_available() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/api/v1/ops/metrics")
    assert resp.status_code == 200
    assert "kutm_http_requests_total" in resp.text
