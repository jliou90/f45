from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"
    __table_args__ = (
        sa.Index("ix_platform_webhooks_tenant", "tenant_id"),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(sa.String(1000), nullable=False)
    secret: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.text("true"),
    )

    # list of event type strings
    event_types: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text("'[]'::jsonb"),
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )


class OutboxMessage(Base):
    __tablename__ = "outbox_messages"
    __table_args__ = (
        sa.Index("ix_platform_outbox_pending", "tenant_id", "status", "next_attempt_at"),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    topic: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[str] = mapped_column(
        sa.String(20),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")

    next_attempt_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    last_error: Mapped[str | None] = mapped_column(sa.String(2000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        sa.Index("ux_platform_idempotency", "tenant_id", "key", unique=True),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    key: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        sa.Index(
            "ux_platform_idempotency_record",
            "tenant_id",
            "actor_scope",
            "endpoint_key",
            "idempotency_key",
            unique=True,
        ),
        sa.Index("ix_platform_idempotency_record_tenant_created", "tenant_id", "created_at"),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_scope: Mapped[str] = mapped_column(sa.String(36), nullable=False, server_default="")
    endpoint_key: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    request_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    status_code: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    response_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    resource_type: Mapped[str | None] = mapped_column(sa.String(60), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

