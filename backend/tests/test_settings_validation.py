from __future__ import annotations

import pytest
from app.core.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient


def test_prod_with_weak_jwt_secret_fails_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    cfg = Settings(
        _env_file=None,
        jwt_secret="weak-secret",
        database_url="postgresql+psycopg://kutm:password@127.0.0.1:5432/kutm",
        bootstrap_enabled=False,
    )

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        cfg.validate_runtime()


def test_dev_allows_weak_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "dev")
    cfg = Settings(
        _env_file=None,
        jwt_secret="weak-secret",
        database_url="sqlite:///dev.db",
        bootstrap_enabled=False,
    )

    cfg.validate_runtime()


def test_app_startup_fails_fast_for_invalid_prod_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", "too-short")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://kutm:password@127.0.0.1:5432/kutm")
    monkeypatch.delenv("BOOTSTRAP_TOKEN", raising=False)
    monkeypatch.setenv("BOOTSTRAP_ENABLED", "0")

    app = create_app()
    with pytest.raises(RuntimeError, match="Invalid production configuration"), TestClient(app):
        pass
