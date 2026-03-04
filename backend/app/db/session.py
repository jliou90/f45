from __future__ import annotations

import os
from collections.abc import Generator
from functools import lru_cache
from pathlib import Path

# Ensure ALL models/tables are registered in SQLAlchemy metadata before any
# flush/commit occurs. This prevents NoReferencedTableError in scripts/tests.
import app.db.metadata  # noqa: F401
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.core.config import settings
from app.core.uow import UnitOfWork
from fastapi import Depends
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def _make_engine():
    """
    Build an engine that is stable for:
    - FastAPI runtime
    - Alembic
    - one-off scripts / smoke tests
    """
    url = settings.sqlalchemy_database_url

    # Optional: support settings.sqlalchemy_echo if you add it later.
    echo = bool(getattr(settings, "sqlalchemy_echo", False))

    engine_kwargs = {
        "pool_pre_ping": True,
        "future": True,  # SQLAlchemy 2.x style behavior
        "echo": echo,
    }
    if not url.startswith("sqlite"):
        engine_kwargs.update(
            {
                "pool_size": _env_int("KUTM_DB_POOL_SIZE", 20),
                "max_overflow": _env_int("KUTM_DB_MAX_OVERFLOW", 40),
                "pool_timeout": _env_int("KUTM_DB_POOL_TIMEOUT_SECONDS", 30),
                "pool_recycle": _env_int("KUTM_DB_POOL_RECYCLE_SECONDS", 1800),
            }
        )
    return create_engine(url, **engine_kwargs)


engine = _make_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency: yields a DB session and always closes it.
    Transaction boundaries (commit/rollback) should be handled by callers.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> sessionmaker[Session]:
    return SessionLocal


def get_uow(db: Session = Depends(get_db)) -> UnitOfWork:
    return UnitOfWork.for_existing_session(db)


def dispose_engine() -> None:
    engine.dispose()


def get_engine_pool_snapshot() -> dict[str, int] | None:
    pool = getattr(engine, "pool", None)
    if pool is None:
        return None

    try:
        return {
            "size": int(pool.size()),
            "checked_in": int(pool.checkedin()),
            "checked_out": int(pool.checkedout()),
            "overflow": int(pool.overflow()),
        }
    except Exception:
        return None


def database_ready(*, timeout_ms: int = 250) -> tuple[bool, str | None]:
    _ = timeout_ms  # retained for backward compatibility of callers/config.
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # pragma: no cover - depends on runtime DB state
        return False, str(exc)


@lru_cache(maxsize=1)
def _expected_alembic_heads() -> set[str]:
    backend_dir = Path(__file__).resolve().parents[2]
    alembic_ini = backend_dir / "alembic.ini"
    migrations_dir = backend_dir / "migrations"

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(migrations_dir))
    script = ScriptDirectory.from_config(cfg)
    return set(script.get_heads())


def migrations_at_head() -> tuple[bool, dict[str, object]]:
    expected = _expected_alembic_heads()

    try:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT version_num FROM alembic_version"))
            current = {str(row[0]) for row in rows}
    except Exception as exc:  # pragma: no cover - depends on runtime DB state
        return False, {
            "error": str(exc),
            "expected_heads": sorted(expected),
            "current_heads": [],
        }

    ok = current == expected
    details = {
        "expected_heads": sorted(expected),
        "current_heads": sorted(current),
    }
    return ok, details
