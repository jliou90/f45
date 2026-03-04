from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.db.base import Base
from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    memberships = relationship(
        "Membership",
        back_populates="tenant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Membership(Base):
    """User <-> Tenant join model with per-tenant role."""

    __tablename__ = "memberships"
    __table_args__ = (
        # Matches existing DB index:
        # CREATE INDEX ix_memberships_user_id ON public.memberships (user_id)
        Index("ix_memberships_user_id", "user_id"),
        Index("ix_memberships_tenant_role_id", "tenant_id", "role_id"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid4()),
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Admin / Manager / User (kept as free-form string for now)
    role: Mapped[str] = mapped_column(String(32), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )

    tenant = relationship(
        "Tenant",
        back_populates="memberships",
        passive_deletes=True,
    )
    user = relationship(
        "User",
        back_populates="memberships",
        passive_deletes=True,
    )
