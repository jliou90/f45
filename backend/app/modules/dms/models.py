from __future__ import annotations

from datetime import datetime

from app.db.base import Base
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

# -----------------------------
# Mixins (10-year maintainability)
# -----------------------------

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SoftDeleteMixin:
    """
    Soft delete:
      - is_deleted: fast filter
      - deleted_at: audit/troubleshooting
    """
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VersionedMixin:
    """
    Optimistic locking via integer version.
    Increment on each successful write.
    """
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


# -----------------------------
# DMS Models
# -----------------------------

class Customer(Base, TimestampMixin, SoftDeleteMixin, VersionedMixin):
    __tablename__ = "customers"

    # Keep UUID-as-string for now (stable + portable)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), index=True)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    address1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    zip: Mapped[str | None] = mapped_column(String(10), nullable=True)

    __table_args__ = (
        # tenant + soft delete filter speed
        Index("ix_customers_tenant_deleted", "tenant_id", "is_deleted"),
        # optional: common lookup pattern (name sorting + search)
        Index("ix_customers_tenant_last_first", "tenant_id", "last_name", "first_name"),
    )


class Vehicle(Base, TimestampMixin, SoftDeleteMixin, VersionedMixin):
    __tablename__ = "vehicles"

    __table_args__ = (
        UniqueConstraint("tenant_id", "vin", name="uq_vehicle_tenant_vin"),
        Index("ix_vehicles_tenant_deleted", "tenant_id", "is_deleted"),
        # very common “garage by customer”
        Index("ix_vehicles_tenant_customer", "tenant_id", "customer_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), index=True)

    customer_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("customers.id"),
        nullable=True,
        index=True,
    )

    vin: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    make: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trim: Mapped[str | None] = mapped_column(String(50), nullable=True)

    mileage: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Appointment(Base, TimestampMixin, SoftDeleteMixin, VersionedMixin):
    __tablename__ = "appointments"

    __table_args__ = (
        Index("ix_appts_tenant_deleted", "tenant_id", "is_deleted"),
        # your most common query: calendar view
        Index("ix_appts_tenant_start", "tenant_id", "scheduled_start"),
        # also common: filter by customer/vehicle
        Index("ix_appts_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_appts_tenant_vehicle", "tenant_id", "vehicle_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), index=True)

    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), index=True)
    vehicle_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )

    scheduled_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="scheduled", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    technician_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    service_advisor_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )


class CustomerCrmProfile(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "customer_crm_profiles"

    __table_args__ = (
        UniqueConstraint("tenant_id", "customer_id", name="uq_customer_crm_tenant_customer"),
        Index("ix_customer_crm_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_customer_crm_tenant_updated", "tenant_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), index=True)

    dms_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    spouse_first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    spouse_last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    spouse_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    spouse_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spouse_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    household_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    household_relationship: Mapped[str | None] = mapped_column(String(100), nullable=True)
    linked_customer_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    phones: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    emails: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    garage: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    notes: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    communications: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    tasks: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    attachments: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
