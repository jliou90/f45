from __future__ import annotations

import logging
import os
import threading
import time
from collections import Counter

from app.core.request_id import get_request_id
from app.db.session import get_engine_pool_snapshot
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _fmt_labels(labels: dict[str, str]) -> str:
    def _esc(value: str) -> str:
        return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

    parts = [f'{k}="{_esc(v)}"' for k, v in labels.items()]
    return "{" + ",".join(parts) + "}"


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._request_total: Counter[tuple[str, str, str]] = Counter()
        self._error_total: Counter[tuple[str, str, str]] = Counter()
        self._latency_sum_ms: Counter[tuple[str, str, str]] = Counter()
        self._latency_count: Counter[tuple[str, str, str]] = Counter()
        self._latency_buckets: Counter[tuple[str, str, str, str]] = Counter()
        self._bucket_bounds = (5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000)

    def observe_request(self, *, method: str, path: str, status_code: int, duration_ms: float) -> None:
        status = str(status_code)
        key = (method.upper(), path, status)
        with self._lock:
            self._request_total[key] += 1
            if status_code >= 400:
                self._error_total[key] += 1

            self._latency_sum_ms[key] += duration_ms
            self._latency_count[key] += 1
            for bound in self._bucket_bounds:
                if duration_ms <= bound:
                    self._latency_buckets[(method.upper(), path, status, str(bound))] += 1
            self._latency_buckets[(method.upper(), path, status, "+Inf")] += 1

    def render_prometheus(self) -> str:
        lines: list[str] = []
        with self._lock:
            lines.extend(
                [
                    "# HELP kutm_http_requests_total Total HTTP requests.",
                    "# TYPE kutm_http_requests_total counter",
                ]
            )
            for (method, path, status), count in sorted(self._request_total.items()):
                labels = _fmt_labels({"method": method, "path": path, "status_code": status})
                lines.append(f"kutm_http_requests_total{labels} {count}")

            lines.extend(
                [
                    "# HELP kutm_http_errors_total Total HTTP error responses (status >= 400).",
                    "# TYPE kutm_http_errors_total counter",
                ]
            )
            for (method, path, status), count in sorted(self._error_total.items()):
                labels = _fmt_labels({"method": method, "path": path, "status_code": status})
                lines.append(f"kutm_http_errors_total{labels} {count}")

            lines.extend(
                [
                    "# HELP kutm_http_request_duration_ms HTTP request latency in milliseconds.",
                    "# TYPE kutm_http_request_duration_ms histogram",
                ]
            )
            for (method, path, status, bound), count in sorted(self._latency_buckets.items()):
                labels = _fmt_labels({"method": method, "path": path, "status_code": status, "le": bound})
                lines.append(f"kutm_http_request_duration_ms_bucket{labels} {count}")
            for (method, path, status), count in sorted(self._latency_count.items()):
                labels = _fmt_labels({"method": method, "path": path, "status_code": status})
                lines.append(f"kutm_http_request_duration_ms_count{labels} {count}")
            for (method, path, status), value in sorted(self._latency_sum_ms.items()):
                labels = _fmt_labels({"method": method, "path": path, "status_code": status})
                lines.append(f"kutm_http_request_duration_ms_sum{labels} {value:.6f}")

        pool = get_engine_pool_snapshot()
        if pool:
            lines.extend(
                [
                    "# HELP kutm_db_pool_size SQLAlchemy pool size.",
                    "# TYPE kutm_db_pool_size gauge",
                    f"kutm_db_pool_size {pool.get('size', 0)}",
                    "# HELP kutm_db_pool_checked_out SQLAlchemy checked out connections.",
                    "# TYPE kutm_db_pool_checked_out gauge",
                    f"kutm_db_pool_checked_out {pool.get('checked_out', 0)}",
                    "# HELP kutm_db_pool_checked_in SQLAlchemy checked in connections.",
                    "# TYPE kutm_db_pool_checked_in gauge",
                    f"kutm_db_pool_checked_in {pool.get('checked_in', 0)}",
                    "# HELP kutm_db_pool_overflow SQLAlchemy pool overflow.",
                    "# TYPE kutm_db_pool_overflow gauge",
                    f"kutm_db_pool_overflow {pool.get('overflow', 0)}",
                ]
            )

        return "\n".join(lines) + "\n"


metrics_registry = MetricsRegistry()


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        rid = getattr(request.state, "request_id", None) or request.headers.get("X-Request-Id") or get_request_id()
        incoming_correlation = request.headers.get("X-Correlation-Id")
        correlation_id = incoming_correlation.strip() if incoming_correlation and incoming_correlation.strip() else rid
        request.state.correlation_id = correlation_id

        status_code = 500
        response: Response | None = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            method = request.method
            path = request.url.path
            tenant_id = request.headers.get("X-Tenant-Id")
            actor_id = getattr(getattr(request.state, "current_user", None), "id", None)

            metrics_registry.observe_request(
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=elapsed_ms,
            )

            if response is not None and correlation_id:
                response.headers.setdefault("X-Correlation-Id", correlation_id)

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
                    "correlation_id": correlation_id,
                },
            )


def configure_tracing(app: FastAPI) -> None:
    if not _env_bool("KUTM_TRACING_ENABLED", False):
        return
    try:
        from app.db.session import engine
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument(engine=engine)
        logger.info("opentelemetry_instrumentation_enabled")
    except Exception as exc:  # pragma: no cover - environment dependent
        logger.warning("opentelemetry_instrumentation_unavailable reason=%s", str(exc))
