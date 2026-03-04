from __future__ import annotations

import logging

from app.main import create_app
from fastapi.testclient import TestClient


def test_request_logs_include_structured_fields(caplog) -> None:
    app = create_app()
    client = TestClient(app)
    caplog.set_level(logging.INFO)

    resp = client.get(
        "/health",
        headers={
            "X-Request-Id": "req-log-1",
            "X-Correlation-Id": "corr-log-1",
            "X-Tenant-Id": "tenant-123",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-Id") == "req-log-1"
    assert resp.headers.get("X-Correlation-Id") == "corr-log-1"

    records = [r for r in caplog.records if "http_request" in r.getMessage()]
    assert records, "expected at least one http_request log record"

    rec = records[-1]
    assert getattr(rec, "request_id", None) == "req-log-1"
    assert getattr(rec, "tenant_id", None) == "tenant-123"
    assert getattr(rec, "path", None) == "/health"
    assert getattr(rec, "method", None) == "GET"
    assert getattr(rec, "status_code", None) == 200
    assert isinstance(getattr(rec, "duration_ms", None), float)
    assert getattr(rec, "correlation_id", None) == "corr-log-1"
