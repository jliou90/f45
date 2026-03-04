from __future__ import annotations

from app.main import create_app


def test_openapi_generation_does_not_error() -> None:
    app = create_app()
    spec = app.openapi()

    assert isinstance(spec, dict)
    assert "openapi" in spec
    assert "paths" in spec
    assert "/api/v1/auth/login" in spec["paths"]
