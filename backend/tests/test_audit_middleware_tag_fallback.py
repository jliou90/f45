from __future__ import annotations

from collections.abc import Callable

from app.core.audit_middleware import AuditMiddleware
from app.core.audit_tags import set_audit
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient


class _FakeSession:
    def __init__(self, sink: list[object]) -> None:
        self._sink = sink

    def add(self, record: object) -> None:
        self._sink.append(record)

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        return None


class _FakeUow:
    def __init__(self, _factory: Callable[[], object], sink: list[object]) -> None:
        self._sink = sink
        self._session: _FakeSession | None = None

    def __enter__(self) -> _FakeSession:
        self._session = _FakeSession(self._sink)
        return self._session

    def __exit__(self, exc_type, exc, tb) -> bool:
        if self._session is None:
            return False
        if exc_type is None:
            self._session.commit()
        else:
            self._session.rollback()
        self._session.close()
        return False


def test_audit_tag_falls_back_when_explicit_fields_absent(monkeypatch) -> None:
    captured: list[object] = []

    monkeypatch.setattr("app.core.audit_middleware.get_session_factory", lambda: lambda: None)
    monkeypatch.setattr("app.core.audit_middleware.UnitOfWork", lambda factory: _FakeUow(factory, captured))

    app = FastAPI()
    app.add_middleware(AuditMiddleware, enabled=True)

    @app.get("/audit-tag")
    async def route_with_tag(request: Request) -> dict[str, bool]:
        set_audit(request, action="demo.action", entity="demo", entity_id="demo-1")
        return {"ok": True}

    with TestClient(app) as client:
        response = client.get("/audit-tag")
        assert response.status_code == 200

    assert len(captured) == 1
    record = captured[0]
    assert getattr(record, "action", None) == "demo.action"
    assert getattr(record, "entity_type", None) == "demo"
    assert getattr(record, "entity_id", None) == "demo-1"


def test_explicit_audit_fields_override_tag(monkeypatch) -> None:
    captured: list[object] = []

    monkeypatch.setattr("app.core.audit_middleware.get_session_factory", lambda: lambda: None)
    monkeypatch.setattr("app.core.audit_middleware.UnitOfWork", lambda factory: _FakeUow(factory, captured))

    app = FastAPI()
    app.add_middleware(AuditMiddleware, enabled=True)

    @app.get("/audit-tag-override")
    async def route_with_override(request: Request) -> dict[str, bool]:
        set_audit(request, action="demo.action", entity="demo", entity_id="demo-1")
        request.state.audit_action = "override.action"
        request.state.audit_entity_type = "override"
        request.state.audit_entity_id = "override-1"
        return {"ok": True}

    with TestClient(app) as client:
        response = client.get("/audit-tag-override")
        assert response.status_code == 200

    assert len(captured) == 1
    record = captured[0]
    assert getattr(record, "action", None) == "override.action"
    assert getattr(record, "entity_type", None) == "override"
    assert getattr(record, "entity_id", None) == "override-1"
