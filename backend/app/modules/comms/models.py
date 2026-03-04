from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class OutboundCommunication(Base):
    __tablename__ = "outbound_communications"
    __table_args__ = (
        sa.Index("ix_platform_outbound_comms_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        sa.Index("ix_platform_outbound_comms_tenant_customer", "tenant_id", "customer_id"),
        sa.Index("ix_platform_outbound_comms_tenant_created", "tenant_id", "created_at"),
        {"schema": "platform"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    entity_type: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    customer_id: Mapped[str | None] = mapped_column(sa.String(36), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    deal_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)
    channel: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'email'"))
    to_address: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    subject: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    body: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'queued'"))
    provider_message_id: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    error: Mapped[str | None] = mapped_column(sa.String(2000), nullable=True)
    attachment_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("readmodels.document_attachments.id", ondelete="SET NULL"),
        nullable=True,
    )
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    created_by: Mapped[str | None] = mapped_column(sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
