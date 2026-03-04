from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "name", name="ux_platform_roles_tenant_name"),
        sa.Index("ix_platform_roles_tenant_name", "tenant_id", "name"),
    )

    id: Mapped[str] = mapped_column(
        sa.String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    tenant_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
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


class PermissionGrant(Base):
    __tablename__ = "permissions"

    key: Mapped[str] = mapped_column(sa.String(120), primary_key=True)
    description: Mapped[str] = mapped_column(sa.String(500), nullable=False)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (
        sa.UniqueConstraint("role_id", "permission_key", name="ux_platform_role_permissions"),
        sa.Index("ix_platform_role_permissions_role_id", "role_id"),
    )

    role_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_key: Mapped[str] = mapped_column(
        sa.String(120),
        sa.ForeignKey("permissions.key", ondelete="CASCADE"),
        primary_key=True,
    )

