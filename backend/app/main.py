from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.audit_middleware import AuditMiddleware
from app.core.config import AppEnv, settings, validate_runtime_settings
from app.core.contracts import enforce_no_list_response_models
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    IdempotencyRequirementMiddleware,
    RateLimitMiddleware,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.observability import ObservabilityMiddleware, configure_tracing, metrics_registry
from app.core.version import build_info
from app.db.session import database_ready, dispose_engine, migrations_at_head
from app.router.api import api_router


def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_csv(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "")
    if not raw.strip():
        return default
    return [x.strip() for x in raw.split(",") if x.strip()]


def _app_env() -> AppEnv:
    raw = (os.getenv("APP_ENV") or os.getenv("ENV") or settings.env).strip().lower()
    if raw in {"prod", "production"}:
        return AppEnv.PROD
    if raw in {"test", "testing"}:
        return AppEnv.TEST
    return AppEnv.DEV


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_runtime_settings()
    yield
    dispose_engine()


def create_app() -> FastAPI:
    configure_logging()
    env = _app_env()
    is_dev = env is AppEnv.DEV

    app = FastAPI(
        title="KUTM API",
        lifespan=lifespan,
    )

    # --- middleware ---
    # FastAPI/Starlette executes the last-added middleware first.
    # This order ensures request ids are available before request logging.
    app.add_middleware(ObservabilityMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(IdempotencyRequirementMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Trust hosts in prod (prevents Host header attacks).
    # In dev, keep permissive unless explicitly set.
    if (not is_dev) or os.getenv("TRUSTED_HOSTS"):
        default_trusted_hosts = ["localhost", "127.0.0.1"]
        if env is AppEnv.TEST:
            default_trusted_hosts.append("testserver")
        trusted_hosts = _env_csv("TRUSTED_HOSTS", default_trusted_hosts)
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

    # Audit log (best-effort)
    app.add_middleware(AuditMiddleware, enabled=_env_bool("AUDIT_ENABLED", True))

    # --- CORS ---
    # Dev default supports Vite. Override in env for staging/prod:
    # CORS_ALLOW_ORIGINS="https://example.com,https://admin.example.com"
    default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"] if is_dev else []
    allow_origins = _env_csv("CORS_ALLOW_ORIGINS", default_origins)
    allow_origin_regex: str | None = os.getenv("CORS_ALLOW_ORIGIN_REGEX")  # optional

    # Important for browser clients:
    # - allow_headers="*" permits Authorization + X-Tenant-Id
    # - expose_headers includes X-Request-Id so FE can correlate errors/logs
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins if not allow_origin_regex else [],
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id", "X-Correlation-Id"],
    )

    # --- exception handlers (canonical envelope) ---
    register_exception_handlers(app, is_dev=is_dev)

    # --- health / ops ---
    # Keep these super lightweight (no DB touch) so they respond even if DB is down.
    @app.get("/health", include_in_schema=False)
    async def health():
        # Backward-compatible alias kept for older clients/tests.
        return {"status": "ok"}

    @app.get("/version", include_in_schema=False)
    async def version():
        # Backward-compatible alias kept for older clients/tests.
        info = build_info()
        return {"app": info["app"], "env": info["env"], "version": info["version"], "git_sha": info["git_sha"]}

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        return {"ok": True}

    @app.get("/livez", include_in_schema=False)
    async def livez():
        return {"live": True}

    @app.get("/readyz", include_in_schema=False)
    async def readyz(response: Response):
        db_ok, db_err = database_ready(timeout_ms=int(os.getenv("READYZ_DB_TIMEOUT_MS", "250")))
        migrations_ok, migrations_details = migrations_at_head()

        ready = db_ok and migrations_ok
        if not ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

        errors: list[str] = []
        if db_err:
            errors.append(f"db: {db_err}")
        if not migrations_ok and isinstance(migrations_details.get("error"), str):
            errors.append(f"migrations: {migrations_details['error']}")

        return {
            "ready": ready,
            "checks": {
                "db": db_ok,
                "migrations": migrations_ok,
            },
            "migrations": migrations_details,
            "error": "; ".join(errors) if errors else None,
        }

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return PlainTextResponse(
            content=metrics_registry.render_prometheus(),
            media_type="text/plain; version=0.0.4",
        )

    configure_tracing(app)

    # --- routes ---
    app.include_router(api_router)
    # --- post-route guards ---
    enforce_no_list_response_models(app)

    return app


app = create_app()
