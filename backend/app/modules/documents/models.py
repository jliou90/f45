from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        sa.PrimaryKeyConstraint("tenant_id", "doc_type", "doc_id", name="pk_documents"),
        sa.Index("ix_readmodels_documents_type", "tenant_id", "doc_type"),
        sa.Index("ix_readmodels_documents_gin", "document", postgresql_using="gin"),
        {"schema": "readmodels"},
    )

    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    doc_id: Mapped[str] = mapped_column(sa.String(36), nullable=False)

    version: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    document: Mapped[dict] = mapped_column(JSONB, nullable=False)


class DocumentAttachment(Base):
    __tablename__ = "document_attachments"
    __table_args__ = (
        sa.Index("ix_readmodels_doc_attachments_tenant_created", "tenant_id", "created_at"),
        {"schema": "readmodels"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    size: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    content: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    created_by: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class DocumentAttachmentLink(Base):
    __tablename__ = "document_attachment_links"
    __table_args__ = (
        sa.Index("ix_readmodels_doc_attachment_links_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        sa.Index(
            "ux_readmodels_doc_attachment_link",
            "tenant_id",
            "attachment_id",
            "entity_type",
            "entity_id",
            unique=True,
        ),
        {"schema": "readmodels"},
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    attachment_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("readmodels.document_attachments.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    created_by: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
