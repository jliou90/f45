from __future__ import annotations

import hashlib
import logging
import os
import time
from collections import deque
from threading import Lock

from app.core.idempotency import IDEMPOTENCY_HEADER, normalize_key, requires_idempotency_header
from app.core.request_id import get_request_id, new_request_id, set_request_id
from app.db.session import engine
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = request.headers.get("X-Request-Id")
        rid = incoming.strip() if incoming and incoming.strip() else new_request_id()

        set_request_id(rid)
        request.state.request_id = rid
        response = await call_next(request)

        response.headers["X-Request-Id"] = get_request_id() or rid
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        rid = getattr(request.state, "request_id", None) or request.headers.get("X-Request-Id") or get_request_id()
        tenant_id = request.headers.get("X-Tenant-Id")
        actor_id = getattr(getattr(request.state, "current_user", None), "id", None)
        path = request.url.path
        method = request.method
        status_code = response.status_code
        logger.info(
            "http_request method=%s path=%s status=%s request_id=%s duration_ms=%.2f",
            method,
            path,
            status_code,
            rid,
            elapsed_ms,
            extra={
                "request_id": rid,
                "tenant_id": tenant_id,
                "actor_id": actor_id,
                "path": path,
                "method": method,
                "status_code": status_code,
                "duration_ms": round(elapsed_ms, 2),
            },
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        return response


class IdempotencyRequirementMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not requires_idempotency_header(request):
            return await call_next(request)

        raw = request.headers.get(IDEMPOTENCY_HEADER)
        if raw is None:
            return JSONResponse(
                status_code=428,
                content={
                    "code": "idempotency_required",
                    "message": f"{IDEMPOTENCY_HEADER} header is required for write requests",
                    "details": {},
                    "request_id": get_request_id(),
                },
            )

        try:
            if not normalize_key(raw):
                return JSONResponse(
                    status_code=428,
                    content={
                        "code": "idempotency_required",
                        "message": f"{IDEMPOTENCY_HEADER} header is required for write requests",
                        "details": {},
                        "request_id": get_request_id(),
                    },
                )
        except Exception as exc:
            # normalize_key raises AppError on invalid key shape.
            return JSONResponse(
                status_code=400,
                content={
                    "code": getattr(exc, "code", "idempotency_key_invalid"),
                    "message": getattr(exc, "message", f"{IDEMPOTENCY_HEADER} is invalid"),
                    "details": getattr(exc, "details", {}),
                    "request_id": get_request_id(),
                },
            )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.enabled = (os.getenv("KUTM_RATE_LIMIT_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"})
        self.limit = int(os.getenv("KUTM_RATE_LIMIT_PER_MIN", "60"))
        self.window_seconds = int(os.getenv("KUTM_RATE_LIMIT_WINDOW_SECONDS", "60"))
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._max_keys = int(os.getenv("KUTM_RATE_LIMIT_MAX_KEYS", "10000"))
        self._db_backend_enabled = self._use_db_backend()
        self._db_backend_healthy = False
        self._db_cleanup_interval = int(os.getenv("KUTM_RATE_LIMIT_DB_CLEANUP_EVERY", "250"))
        self._db_ops = 0
        self._paths = (
            "/api/v1/auth/login",
            "/api/v1/auth/accept-invite",
            "/api/v1/auth/reset-password",
            "/api/v1/ops/bootstrap",
            "/api/v1/acct/journals",
            "/api/v1/acct/batches",
            "/api/v1/funding/deals",
        )
        if self._db_backend_enabled:
            self._db_backend_healthy = self._ensure_db_rate_limit_table()

    def _is_limited_path(self, path: str) -> bool:
        return any(path == prefix or path.startswith(prefix + "/") for prefix in self._paths)

    def _use_db_backend(self) -> bool:
        mode = (os.getenv("KUTM_RATE_LIMIT_BACKEND") or "auto").strip().lower()
        if mode in {"memory", "in_memory"}:
            return False
        if mode in {"db", "database", "postgres"}:
            return True
        # auto
        return getattr(engine.dialect, "name", "") == "postgresql"

    def _ensure_db_rate_limit_table(self) -> bool:
        if getattr(engine.dialect, "name", "") != "postgresql":
            return False
        ddl = """
        CREATE SCHEMA IF NOT EXISTS platform;
        CREATE TABLE IF NOT EXISTS platform.rate_limit_windows (
            key_hash VARCHAR(64) NOT NULL,
            window_start TIMESTAMPTZ NOT NULL,
            hits INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (key_hash, window_start)
        );
        CREATE INDEX IF NOT EXISTS ix_platform_rate_limit_updated_at
            ON platform.rate_limit_windows (updated_at);
        """
        try:
            with engine.begin() as conn:
                for stmt in [s.strip() for s in ddl.split(";") if s.strip()]:
                    conn.execute(text(stmt))
            return True
        except Exception as exc:
            logger.warning("rate_limit_db_backend_unavailable reason=%s", str(exc))
            return False

    def _hit_db_window(self, key: str, now: float) -> int | None:
        if not self._db_backend_enabled or not self._db_backend_healthy:
            return None
        try:
            bucket_start = int(now // self.window_seconds) * self.window_seconds
            window_start = time.strftime("%Y-%m-%d %H:%M:%S+00:00", time.gmtime(bucket_start))
            key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
            with engine.begin() as conn:
                row = conn.execute(
                    text(
                        """
                        INSERT INTO platform.rate_limit_windows (key_hash, window_start, hits, updated_at)
                        VALUES (:key_hash, CAST(:window_start AS timestamptz), 1, now())
                        ON CONFLICT (key_hash, window_start)
                        DO UPDATE SET
                            hits = platform.rate_limit_windows.hits + 1,
                            updated_at = now()
                        RETURNING hits
                        """
                    ),
                    {"key_hash": key_hash, "window_start": window_start},
                ).one()
                self._db_ops += 1
                if self._db_ops % max(1, self._db_cleanup_interval) == 0:
                    conn.execute(
                        text(
                            """
                            DELETE FROM platform.rate_limit_windows
                            WHERE updated_at < now() - make_interval(secs => :retention_seconds)
                            """
                        ),
                        {"retention_seconds": int(self.window_seconds * 10)},
                    )
                return int(row[0])
        except Exception as exc:
            logger.warning("rate_limit_db_backend_error reason=%s", str(exc))
            self._db_backend_healthy = False
            return None

    def _rate_limit_key(self, request: Request) -> str:
        client_host = request.client.host if request.client else "unknown"
        tenant_id = (request.headers.get("X-Tenant-Id") or "").strip()
        if tenant_id:
            return f"{client_host}:{request.url.path}:tenant:{tenant_id}"
        return f"{client_host}:{request.url.path}"

    async def dispatch(self, request: Request, call_next) -> Response:
        if not self.enabled or request.method.upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)
        if not self._is_limited_path(request.url.path):
            return await call_next(request)

        now = time.time()
        key = self._rate_limit_key(request)

        db_hits = self._hit_db_window(key=key, now=now)
        if db_hits is not None:
            if db_hits > self.limit:
                r = JSONResponse(
                    status_code=429,
                    content={
                        "code": "rate_limited",
                        "message": "Too many requests",
                        "details": {},
                        "request_id": get_request_id(),
                    },
                )
                r.headers["Retry-After"] = str(self.window_seconds)
                return r
            return await call_next(request)

        with self._lock:
            q = self._hits.setdefault(key, deque())
            cutoff = now - float(self.window_seconds)
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.limit:
                r = JSONResponse(
                    status_code=429,
                    content={
                        "code": "rate_limited",
                        "message": "Too many requests",
                        "details": {},
                        "request_id": get_request_id(),
                    },
                )
                r.headers["Retry-After"] = str(self.window_seconds)
                return r
            q.append(now)
            # Bound memory for high-cardinality request keys.
            if len(self._hits) > self._max_keys:
                stale_keys = [k for k, dq in self._hits.items() if not dq or dq[-1] < cutoff]
                for stale in stale_keys[: max(1, len(self._hits) - self._max_keys)]:
                    self._hits.pop(stale, None)
        return await call_next(request)
