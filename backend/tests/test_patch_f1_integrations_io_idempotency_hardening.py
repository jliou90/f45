from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from app.core.errors import AppError
from app.core.idempotency import claim_idempotency_key
from app.modules.integrations import api as integrations_api
from app.modules.integrations import service as integrations_service
from app.modules.integrations.schemas import WebhookUpdate
from app.modules.io import api as io_api
from fastapi import HTTPException


class _FakeQuery:
    def __init__(self, *, one_or_none_result: object | None = None, delete_result: int = 0) -> None:
        self._one_or_none_result = one_or_none_result
        self._delete_result = delete_result
        self.delete_called = False

    def filter(self, *_args: object, **_kwargs: object) -> _FakeQuery:
        return self

    def one_or_none(self) -> object | None:
        return self._one_or_none_result

    def delete(self, **_kwargs: object) -> int:
        self.delete_called = True
        return self._delete_result

    def one(self) -> object:
        if self._one_or_none_result is None:
            raise RuntimeError("No result configured")
        return self._one_or_none_result


class _FakeIdempotencyDb:
    def __init__(self, *, existing: object | None = None) -> None:
        self._purge_query = _FakeQuery(delete_result=1)
        self._lookup_query = _FakeQuery(one_or_none_result=existing)
        self.added: list[object] = []
        self.flushed = False
        self._query_calls = 0

    def query(self, _model: object) -> _FakeQuery:
        self._query_calls += 1
        if self._query_calls == 1:
            return self._purge_query
        return self._lookup_query

    def add(self, obj: object) -> None:
        self.added.append(obj)

    def flush(self) -> None:
        self.flushed = True


def test_webhook_update_api_forwards_all_mutable_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    now = datetime.now(UTC)

    class _FakeUow:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *_args: object) -> None:
            return None

    def _fake_update_webhook(**kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(
            id="wh-1",
            tenant_id="tenant-1",
            url=str(kwargs["url"]),
            enabled=bool(kwargs["enabled"]),
            event_types=kwargs["event_types"],
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr(integrations_api, "update_webhook", _fake_update_webhook)

    out = integrations_api.webhooks_update(
        webhook_id="wh-1",
        payload=WebhookUpdate(
            url="https://hooks.example.com/new",
            secret="new-secret-123",
            enabled=False,
            event_types=["deal.booked"],
        ),
        uow=_FakeUow(),  # type: ignore[arg-type]
        tenant_id="tenant-1",
    )

    assert captured["url"] == "https://hooks.example.com/new"
    assert captured["secret"] == "new-secret-123"
    assert captured["enabled"] is False
    assert captured["event_types"] == ["deal.booked"]
    assert out.url == "https://hooks.example.com/new"


def test_webhook_validation_blocks_private_hosts() -> None:
    with pytest.raises(AppError) as exc:
        integrations_service.create_webhook(
            db=SimpleNamespace(add=lambda _x: None, flush=lambda: None),  # type: ignore[arg-type]
            tenant_id="tenant-1",
            url="http://127.0.0.1/webhook",
            secret="secret-123",
            enabled=True,
            event_types=[],
        )
    assert exc.value.code == "integrations_webhook_private_host_blocked"


def test_webhook_validation_allows_public_host() -> None:
    created: list[object] = []
    db = SimpleNamespace(add=lambda x: created.append(x), flush=lambda: None)
    out = integrations_service.create_webhook(
        db=db,  # type: ignore[arg-type]
        tenant_id="tenant-1",
        url="https://hooks.example.com/webhook",
        secret="secret-123",
        enabled=True,
        event_types=["deal.booked"],
    )
    assert out.url == "https://hooks.example.com/webhook"
    assert created


def test_claim_idempotency_key_purges_stale_keys_before_claim() -> None:
    db = _FakeIdempotencyDb(existing=None)
    claim_idempotency_key(db=db, tenant_id="tenant-1", key="k-1")
    assert db._purge_query.delete_called is True
    assert len(db.added) == 1
    assert db.flushed is True


class _FakeUpload:
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = list(chunks)

    async def read(self, _size: int) -> bytes:
        if not self._chunks:
            return b""
        return self._chunks.pop(0)


def test_import_reader_rejects_oversized_payload() -> None:
    upload = _FakeUpload([b"a" * 7, b"b" * 7])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(io_api._read_upload_limited(upload, max_bytes=10))  # type: ignore[arg-type]
    assert exc.value.status_code == 413
