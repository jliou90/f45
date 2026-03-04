from __future__ import annotations

import logging
from typing import Any

from app.core.request_id import get_request_id
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def not_found(message: str, *, code: str = "not_found", details: Any | None = None) -> AppError:
    return AppError(code=code, message=message, status_code=404, details=details)


def conflict(message: str, *, code: str = "conflict", details: Any | None = None) -> AppError:
    return AppError(code=code, message=message, status_code=409, details=details)


def validation_error(message: str, *, code: str = "validation_error", details: Any | None = None) -> AppError:
    return AppError(code=code, message=message, status_code=422, details=details)


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Any | None = None
    request_id: str | None = None


def _status_to_error_code(status_code: int) -> str:
    mapping = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
    }
    return mapping.get(status_code, f"http_{status_code}")


def _build_error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: Any | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        code=code,
        message=message,
        details=details,
        request_id=get_request_id(),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _validation_details(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []
    for err in errors:
        loc = err.get("loc", ())
        parts = [str(x) for x in loc if x not in {"body", "query", "path", "header"}]
        field = ".".join(parts) if parts else "request"
        details.append(
            {
                "field": field,
                "message": err.get("msg", "Invalid value"),
                "type": err.get("type", "validation_error"),
            }
        )
    return details


def register_exception_handlers(app: FastAPI, *, is_dev: bool = False) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        logger.warning(
            "AppError request_id=%s code=%s status=%s message=%s",
            get_request_id(),
            exc.code,
            exc.status_code,
            exc.message,
        )
        return _build_error_response(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = _validation_details(exc.errors())
        logger.warning("ValidationError request_id=%s issues=%s", get_request_id(), len(details))
        return _build_error_response(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            details=details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, str):
            message = detail
            details = None
        else:
            message = "HTTP error"
            details = detail

        code = _status_to_error_code(exc.status_code)
        logger.info(
            "HTTPException request_id=%s code=%s status=%s message=%s",
            get_request_id(),
            code,
            exc.status_code,
            message,
        )
        return _build_error_response(
            status_code=exc.status_code,
            code=code,
            message=message,
            details=details,
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("UnhandledException request_id=%s", get_request_id())
        return _build_error_response(
            status_code=500,
            code="internal_error",
            message="An unexpected error occurred",
            details=str(exc) if is_dev else None,
        )
