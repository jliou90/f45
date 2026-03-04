from __future__ import annotations

from pathlib import Path

from app.main import create_app
from fastapi.testclient import TestClient


def test_ops_version_contract_matches_canonical_version() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/api/v1/ops/version")
    assert resp.status_code == 200

    payload = resp.json()
    assert payload["product_name"] == "KUTM"
    assert isinstance(payload["version"], str)

    canonical = Path(__file__).resolve().parents[2] / "VERSION"
    assert payload["version"] == canonical.read_text(encoding="utf-8").strip()
