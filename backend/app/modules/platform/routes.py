from __future__ import annotations

import logging
import os
import time
from typing import Any

from app.core.rbac import Permission, require_permission
from app.core.request_id import get_request_id
from app.db.session import SessionLocal
from fastapi import APIRouter, Depends
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Platform endpoints MUST NOT collide with global /health + /version.
# Keep them namespaced under /platform for 10-year stability.
router = APIRouter(
    prefix="/platform",
    tags=["platform"],
    dependencies=[Depends(require_permission(Permission.PLATFORM_READ))],
)


def _env(name: str, default: str) -> str:
    v = os.getenv(name)
    return v.strip() if v is not None and v.strip() else default


def _db_ping(timeout_ms: int = 250) -> tuple[bool, str | None, float]:
    """
    Best-effort DB health check.
    Returns: (ok, error_message, duration_ms)
    """
    t0 = time.perf_counter()
    try:
        # Keep this lightweight; no ORM imports, no model touches.
        with SessionLocal() as db:
            # Local statement timeout avoids hanging forever on a bad DB.
            # If your DB user can't SET LOCAL, it will be ignored/raise; we treat as best-effort.
            try:
                db.execute(text("SET LOCAL statement_timeout = :ms"), {"ms": timeout_ms})
            except Exception as exc:
                logger.debug("db_statement_timeout_not_applied reason=%s", str(exc))

            db.execute(text("SELECT 1"))
        dt_ms = (time.perf_counter() - t0) * 1000.0
        return True, None, dt_ms
    except Exception as e:
        dt_ms = (time.perf_counter() - t0) * 1000.0
        return False, str(e), dt_ms


@router.get("/health")
def platform_health() -> dict[str, Any]:
    """
    Platform health (namespaced). Safe for ops dashboards.
    Includes a best-effort DB ping.
    """
    ok, err, ms = _db_ping(timeout_ms=int(_env("PLATFORM_DB_PING_TIMEOUT_MS", "250")))

    status = "ok" if ok else "degraded"
    # In prod you may not want to leak DB error strings; toggle via env.
    expose_error = _env("PLATFORM_HEALTH_EXPOSE_ERROR", "0").lower() in {"1", "true", "yes", "on"}

    payload: dict[str, Any] = {
        "status": status,
        "db_ok": ok,
        "db_ms": round(ms, 2),
        "request_id": get_request_id(),
    }
    if not ok and expose_error:
        payload["db_error"] = err

    return payload


@router.get("/version")
def platform_version() -> dict[str, str]:
    """
    Platform version (namespaced). Mirrors global version info but avoids route collisions.
    """
    return {
        "app": _env("APP_NAME", "KingUnderTheMountain"),
        "env": _env("APP_ENV", _env("ENV", "dev")),
        "version": _env("APP_VERSION", "0.0.0"),
        "request_id": get_request_id(),
    }
