from __future__ import annotations

from app.main import create_app


def test_canonical_auth_routes_present_and_legacy_aliases_absent() -> None:
    app = create_app()
    paths = set(app.openapi().get("paths", {}).keys())

    assert "/api/v1/auth/login" in paths
    assert "/api/v1/auth/refresh" in paths
    assert "/auth/login" not in paths
    assert "/auth/refresh" not in paths
