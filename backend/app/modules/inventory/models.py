from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column


class InventorySupplyItem(Base):
    __tablename__ = "inventory_supply_items"
    __table_args__ = (
        sa.Index("ix_inventory_supply_tenant_name", "tenant_id", "name"),
        sa.UniqueConstraint("tenant_id", "sku", name="ux_inventory_supply_tenant_sku"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    sku: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    on_hand_qty: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    reorder_point: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    reorder_qty: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    unit: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'each'"))
    vendor: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


class InventoryOrderBatch(Base):
    __tablename__ = "inventory_order_batches"
    __table_args__ = (
        sa.Index("ix_inventory_order_batch_tenant_status", "tenant_id", "status"),
        sa.Index("ix_inventory_order_batch_tenant_created", "tenant_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'draft'"))
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    created_by: Mapped[str | None] = mapped_column(sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())


class InventoryOrderBatchLine(Base):
    __tablename__ = "inventory_order_batch_lines"
    __table_args__ = (
        sa.Index("ix_inventory_order_line_batch", "tenant_id", "batch_id"),
        sa.UniqueConstraint("tenant_id", "batch_id", "supply_item_id", name="ux_inventory_order_line_supply"),
    )

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("inventory_order_batches.id", ondelete="CASCADE"), nullable=False)
    supply_item_id: Mapped[str] = mapped_column(sa.String(36), sa.ForeignKey("inventory_supply_items.id", ondelete="CASCADE"), nullable=False)
    qty: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
