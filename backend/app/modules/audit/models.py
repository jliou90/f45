from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        sa.Index("ix_platform_audit_tenant_time", "tenant_id", "created_at"),
        sa.Index("ix_platform_audit_tenant_actor_time", "tenant_id", "actor_user_id", "created_at"),
        sa.Index("ix_platform_audit_tenant_action_time", "tenant_id", "action", "created_at"),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)

    tenant_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    request_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    method: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    path: Mapped[str] = mapped_column(sa.String(512), nullable=False)
    status_code: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    action: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)

    correlation_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        sa.Index("ix_audit_events_tenant_ts", "tenant_id", "ts"),
        sa.Index("ix_audit_events_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        sa.Index("ix_audit_events_tenant_actor", "tenant_id", "actor_id", "ts"),
        sa.Index("ix_audit_events_tenant_action", "tenant_id", "action", "ts"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    entity_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    ts: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    )
    request_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    actor_ip: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(sa.String(512), nullable=True)
    reason: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'"))
    before: Mapped[dict | None] = mapped_column(sa.JSON(), nullable=True)
    after: Mapped[dict | None] = mapped_column(sa.JSON(), nullable=True)
