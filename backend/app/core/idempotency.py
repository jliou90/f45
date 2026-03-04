from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.config import AppEnv, settings
from app.core.errors import AppError
from app.core.tenancy.context import get_tenant_id_from_request
from app.db.session import get_db
from app.modules.integrations.models import IdempotencyKey, IdempotencyRecord
from fastapi import Depends, Header, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

IDEMPOTENCY_HEADER = "Idempotency-Key"

MAXLEN = int(os.getenv("KUTM_IDEMPOTENCY_MAXLEN", "200"))
KEY_RETENTION_DAYS = int(os.getenv("KUTM_IDEMPOTENCY_KEY_RETENTION_DAYS", "30"))
DEFAULT_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/ops/bootstrap",
}


def _parse_bool(name: str, raw: str, *, default: bool) -> bool:
    value = (raw or "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean-like value")


def _is_enforced() -> bool:
    override = os.getenv("KUTM_IDEMPOTENCY_ENFORCE")
    if override is None:
        return settings.runtime_env is not AppEnv.DEV
    return _parse_bool("KUTM_IDEMPOTENCY_ENFORCE", override, default=False)


def _exempt_paths() -> set[str]:
    raw = (os.getenv("KUTM_IDEMPOTENCY_EXEMPT_PATHS") or "").strip()
    if not raw:
        return set(DEFAULT_EXEMPT_PATHS)
    return {p.strip() for p in raw.split(",") if p.strip()}


def requires_idempotency_header(request: Request) -> bool:
    if not _is_enforced():
        return False
    method = (request.method or "").upper()
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return False
    path = request.url.path
    if not path.startswith("/api/v1"):
        return False
    return path not in _exempt_paths()


def normalize_key(raw: str) -> str:
    k = (raw or "").strip()
    if not k:
        return ""
    if len(k) > MAXLEN:
        raise AppError(
            code="idempotency_key_too_long",
            message=f"{IDEMPOTENCY_HEADER} is too long",
            status_code=400,
            details={"max_len": MAXLEN},
        )
    if "\n" in k or "\r" in k:
        raise AppError(
            code="idempotency_key_invalid",
            message=f"{IDEMPOTENCY_HEADER} is invalid",
            status_code=400,
        )
    return k


def claim_idempotency_key(*, db: Session, tenant_id: str, key: str) -> None:
    _purge_stale_key_claims(db=db, tenant_id=tenant_id)
    existing = (
        db.query(IdempotencyKey)
        .filter(IdempotencyKey.tenant_id == tenant_id, IdempotencyKey.key == key)
        .one_or_none()
    )
    if existing is not None:
        raise AppError(
            code="idempotency_conflict",
            message="Duplicate request (idempotency key already used)",
            status_code=409,
            details={"idempotency_key": key},
        )

    rec = IdempotencyKey(id=str(uuid4()), tenant_id=tenant_id, key=key)
    db.add(rec)
    db.flush()


def _purge_stale_key_claims(*, db: Session, tenant_id: str) -> int:
    if KEY_RETENTION_DAYS <= 0:
        return 0
    cutoff = datetime.now(UTC) - timedelta(days=KEY_RETENTION_DAYS)
    deleted = (
        db.query(IdempotencyKey)
        .filter(IdempotencyKey.tenant_id == tenant_id, IdempotencyKey.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    return int(deleted or 0)


def idempotency_guard(
    request: Request,
    key: str | None = Header(default=None, alias=IDEMPOTENCY_HEADER),
    db: Session = Depends(get_db),
) -> None:
    if not key:
        if requires_idempotency_header(request):
            raise AppError(
                code="idempotency_required",
                message=f"{IDEMPOTENCY_HEADER} header is required for write requests",
                status_code=428,
            )
        return

    normalized = normalize_key(key)
    if not normalized:
        if requires_idempotency_header(request):
            raise AppError(
                code="idempotency_required",
                message=f"{IDEMPOTENCY_HEADER} header is required for write requests",
                status_code=428,
            )
        return

    tenant_id = get_tenant_id_from_request(request)
    if not tenant_id:
        return
    claim_idempotency_key(db=db, tenant_id=tenant_id, key=normalized)


def fingerprint_payload(payload: dict | list | None) -> str:
    raw = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class IdempotencyStart:
    record: IdempotencyRecord | None
    replay: dict | None
    status_code: int | None


def start_idempotent_request(
    *,
    db: Session,
    tenant_id: str,
    actor_id: str | None,
    endpoint_key: str,
    idempotency_key: str | None,
    request_payload: dict | list | None,
) -> IdempotencyStart:
    if not idempotency_key:
        return IdempotencyStart(record=None, replay=None, status_code=None)

    normalized = normalize_key(idempotency_key)
    if not normalized:
        return IdempotencyStart(record=None, replay=None, status_code=None)

    actor_scope = (actor_id or "").strip()
    req_hash = fingerprint_payload(request_payload)

    record = (
        db.query(IdempotencyRecord)
        .filter(
            IdempotencyRecord.tenant_id == tenant_id,
            IdempotencyRecord.actor_scope == actor_scope,
            IdempotencyRecord.endpoint_key == endpoint_key,
            IdempotencyRecord.idempotency_key == normalized,
        )
        .one_or_none()
    )
    if record is not None:
        if record.request_hash != req_hash:
            raise AppError(
                code="idempotency_payload_mismatch",
                message="Idempotency key was already used with different request payload",
                status_code=409,
            )
        if record.response_json is not None:
            return IdempotencyStart(record=record, replay=record.response_json, status_code=record.status_code or 200)
        raise AppError(
            code="idempotency_in_progress",
            message="Request with this idempotency key is already in progress",
            status_code=409,
        )

    record = IdempotencyRecord(
        id=str(uuid4()),
        tenant_id=tenant_id,
        actor_scope=actor_scope,
        endpoint_key=endpoint_key,
        idempotency_key=normalized,
        request_hash=req_hash,
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        record = (
            db.query(IdempotencyRecord)
            .filter(
                IdempotencyRecord.tenant_id == tenant_id,
                IdempotencyRecord.actor_scope == actor_scope,
                IdempotencyRecord.endpoint_key == endpoint_key,
                IdempotencyRecord.idempotency_key == normalized,
            )
            .one_or_none()
        )
        if not record:
            raise
        if record.request_hash != req_hash:
            raise AppError(
                code="idempotency_payload_mismatch",
                message="Idempotency key was already used with different request payload",
                status_code=409,
            )
        if record.response_json is not None:
            return IdempotencyStart(record=record, replay=record.response_json, status_code=record.status_code or 200)
        raise AppError(
            code="idempotency_in_progress",
            message="Request with this idempotency key is already in progress",
            status_code=409,
        )

    return IdempotencyStart(record=record, replay=None, status_code=None)


def finalize_idempotent_request(
    *,
    record: IdempotencyRecord | None,
    status_code: int,
    response_json: dict,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    if not record:
        return
    record.status_code = status_code
    record.response_json = response_json
    record.resource_type = resource_type
    record.resource_id = resource_id
