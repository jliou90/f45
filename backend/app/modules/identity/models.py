from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    email: Mapped[str] = mapped_column(sa.String(255), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        default=True,
        server_default=sa.text("true"),
    )
    password_hash: Mapped[str] = mapped_column(sa.String(255))
    is_disabled: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        default=False,
        server_default=sa.text("false"),
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    locked_until: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        default=False,
        server_default=sa.text("false"),
    )
    mfa_secret: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )

    memberships = relationship("Membership", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        sa.Index("ux_refresh_tokens_jti_hash", "jti_hash", unique=True),
        sa.Index("ix_refresh_tokens_user_revoked", "user_id", "revoked_at"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    jti_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    parent_jti_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    user_agent_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    user = relationship("User", back_populates="refresh_tokens")

