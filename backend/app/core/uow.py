from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

SessionT = TypeVar("SessionT", Session, AsyncSession)


class UnitOfWork:
    """Synchronous SQLAlchemy unit of work.

    Commit exactly once on success, rollback on error, always close.
    """

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory
        self.session: Session | None = None
        self._manage_lifecycle = True

    @classmethod
    def for_existing_session(cls, session: Session) -> UnitOfWork:
        uow = cls(lambda: session)
        uow._manage_lifecycle = False
        return uow

    def __enter__(self) -> Session:
        self.session = self._session_factory()
        return self.session

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: Any,
    ) -> Literal[False]:
        if self.session is None:
            return False

        try:
            if exc_type is None:
                self.session.commit()
            else:
                self.session.rollback()
        finally:
            if self._manage_lifecycle:
                self.session.close()
            self.session = None
        return False


class AsyncUnitOfWork:
    """Async SQLAlchemy unit of work with commit/rollback discipline."""

    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._session_factory = session_factory
        self.session: AsyncSession | None = None

    async def __aenter__(self) -> AsyncSession:
        self.session = self._session_factory()
        return self.session

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: Any,
    ) -> Literal[False]:
        if self.session is None:
            return False

        try:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
        finally:
            await self.session.close()
            self.session = None
        return False


def commit_session(session: Session) -> None:
    session.commit()
