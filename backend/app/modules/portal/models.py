from __future__ import annotations

from datetime import datetime

from app.db.base import Base
from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class PortalUserPrefs(Base):
    __tablename__ = "portal_user_prefs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_portal_user_prefs_tenant_user"),
        Index("ix_portal_user_prefs_tenant_updated", "tenant_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    saved_views_json: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    default_view_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    team_queue_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="role_default")
    role_queue_overrides: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
