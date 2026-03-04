from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Stream(Base):
    __tablename__ = "streams"
    __table_args__ = (
        sa.Index(
            "ux_events_streams_tenant_type_id",
            "tenant_id",
            "stream_type",
            "stream_id",
            unique=True,
        ),
        {"schema": "events"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    stream_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    stream_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)

    current_version: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        sa.Index(
            "ux_events_events_stream_version",
            "tenant_id",
            "stream_type",
            "stream_id",
            "version",
            unique=True,
        ),
        sa.Index(
            "ix_events_events_tenant_type_time",
            "tenant_id",
            "event_type",
            "occurred_at",
        ),
        sa.Index(
            "ix_events_events_tenant_stream_time",
            "tenant_id",
            "stream_type",
            "occurred_at",
        ),
        sa.Index(
            "ix_events_events_payload_gin",
            "payload",
            postgresql_using="gin",
        ),
        {"schema": "events"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    stream_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    stream_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    event_type: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

    actor_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    correlation_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)
    causation_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # IMPORTANT: "metadata" is reserved by SQLAlchemy Declarative.
    # Use a different Python attribute name while keeping the DB column name.
    event_metadata: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        server_default=sa.text("'{}'::jsonb"),
    )
