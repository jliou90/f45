from __future__ import annotations

import pytest
from app.core.uow import UnitOfWork


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self.closes = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closes += 1


def test_uow_commits_once_on_success() -> None:
    session = FakeSession()
    uow = UnitOfWork(lambda: session)  # noqa: E731

    with uow as db:
        assert db is session

    assert session.commits == 1
    assert session.rollbacks == 0
    assert session.closes == 1


def test_uow_rolls_back_on_exception() -> None:
    session = FakeSession()
    uow = UnitOfWork(lambda: session)  # noqa: E731

    with pytest.raises(ValueError, match="boom"), uow as db:
        assert db is session
        raise ValueError("boom")

    assert session.commits == 0
    assert session.rollbacks == 1
    assert session.closes == 1
