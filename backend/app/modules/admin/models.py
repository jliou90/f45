from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column


class InviteToken(Base):
    __tablename__ = "invite_tokens"
    __table_args__ = (
        sa.Index("ix_invite_tokens_tenant_status", "tenant_id", "revoked_at", "accepted_at", "expires_at"),
        sa.Index("ix_invite_tokens_tenant_email", "tenant_id", "email"),
        sa.UniqueConstraint("tenant_id", "token_hash", name="ux_invite_tokens_tenant_token_hash"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    role_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    accepted_by_user_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        sa.Index("ix_password_reset_tokens_user_status", "user_id", "consumed_at", "expires_at"),
        sa.UniqueConstraint("token_hash", name="ux_password_reset_tokens_token_hash"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(sa.String(120), primary_key=True)
    description: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    default_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(sa.JSON(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class TenantFeatureOverride(Base):
    __tablename__ = "tenant_feature_overrides"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "flag_key", name="ux_tenant_feature_overrides"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    flag_key: Mapped[str] = mapped_column(sa.String(120), sa.ForeignKey("feature_flags.key", ondelete="CASCADE"), nullable=False)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(sa.JSON(), nullable=True)
    enabled: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("true"))
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        onupdate=sa.func.now(),
    )


class RoleFeatureOverride(Base):
    __tablename__ = "role_feature_overrides"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "role_id", "flag_key", name="ux_role_feature_overrides"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    flag_key: Mapped[str] = mapped_column(sa.String(120), sa.ForeignKey("feature_flags.key", ondelete="CASCADE"), nullable=False)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(sa.JSON(), nullable=True)
    enabled: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("true"))
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        onupdate=sa.func.now(),
    )


class UserFeatureOverride(Base):
    __tablename__ = "user_feature_overrides"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "user_id", "flag_key", name="ux_user_feature_overrides"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    flag_key: Mapped[str] = mapped_column(sa.String(120), sa.ForeignKey("feature_flags.key", ondelete="CASCADE"), nullable=False)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(sa.JSON(), nullable=True)
    enabled: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("true"))
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        onupdate=sa.func.now(),
    )


class TenantProfile(Base):
    __tablename__ = "tenant_profiles"

    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    display_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    legal_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    state: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    phone: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(sa.String(1024), nullable=True)
    theme: Mapped[dict] = mapped_column(sa.JSON(), nullable=False, server_default=sa.text("'{}'"))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        onupdate=sa.func.now(),
    )
