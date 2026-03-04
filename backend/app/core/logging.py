from __future__ import annotations

import json
import logging
import os
import sys
from datetime import UTC, datetime
from collections import deque
from logging.handlers import RotatingFileHandler

from app.core.request_id import get_request_id


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = get_request_id()
        for field in ("tenant_id", "actor_id", "path", "method", "status_code", "duration_ms", "correlation_id"):
            if not hasattr(record, field):
                setattr(record, field, None)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "tenant_id": getattr(record, "tenant_id", None),
            "actor_id": getattr(record, "actor_id", None),
            "path": getattr(record, "path", None),
            "method": getattr(record, "method", None),
            "status_code": getattr(record, "status_code", None),
            "duration_ms": getattr(record, "duration_ms", None),
            "correlation_id": getattr(record, "correlation_id", None),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_LOGGING_CONFIGURED = False
_LOG_RING: deque[dict[str, object]] = deque(maxlen=500)
_ERROR_RING: deque[dict[str, object]] = deque(maxlen=200)


def _redact_text(value: str | None) -> str | None:
    if value is None:
        return None
    redacted = value
    for pattern in [
        ("authorization:", "authorization:[REDACTED]"),
        ("bearer ", "Bearer [REDACTED] "),
        ("token=", "token=[REDACTED]"),
        ("refresh_token=", "refresh_token=[REDACTED]"),
        ("access_token=", "access_token=[REDACTED]"),
    ]:
        redacted = redacted.replace(pattern[0], pattern[1])
    return redacted


class RingBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": _redact_text(record.getMessage()),
            "request_id": getattr(record, "request_id", None),
            "correlation_id": getattr(record, "correlation_id", None),
            "path": getattr(record, "path", None),
            "method": getattr(record, "method", None),
            "status_code": getattr(record, "status_code", None),
        }
        _LOG_RING.append(payload)
        if record.levelno >= logging.ERROR:
            _ERROR_RING.append(payload)


def get_log_tail(limit: int = 50) -> list[dict[str, object]]:
    return list(_LOG_RING)[-max(1, min(limit, 200)) :]


def get_error_tail(limit: int = 20) -> list[dict[str, object]]:
    return list(_ERROR_RING)[-max(1, min(limit, 100)) :]


def configure_logging() -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestContextFilter())
    root.addHandler(handler)
    ring = RingBufferHandler()
    ring.addFilter(RequestContextFilter())
    root.addHandler(ring)

    _LOGGING_CONFIGURED = True


def init_file_logging(log_dir: str = "logs", error_filename: str = "errors.txt") -> None:
    """Initialize simple file logging.
    - Writes ERROR+ to logs/errors.txt
    - Writes INFO+ to logs/app.txt (rotated)
    """
    os.makedirs(log_dir, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")

    err_path = os.path.join(log_dir, error_filename)
    err_handler = RotatingFileHandler(err_path, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
    err_handler.setLevel(logging.ERROR)
    err_handler.setFormatter(fmt)

    app_path = os.path.join(log_dir, "app.txt")
    app_handler = RotatingFileHandler(app_path, maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    app_handler.setLevel(logging.INFO)
    app_handler.setFormatter(fmt)

    root.addHandler(app_handler)
    root.addHandler(err_handler)
