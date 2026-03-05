from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from app.db.base import Base
from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

# -----------------------------
# Enums (stored as strings)
# -----------------------------

class PeriodStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"


class NormalBalance(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


# -----------------------------
# Models
# -----------------------------

class AcctAccount(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_acct_account_tenant_number"),
        Index("ix_acct_account_tenant_active", "tenant_id", "is_active"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    number: Mapped[str] = mapped_column(String(32), nullable=False)  # "1000", "4010", etc.
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    type: Mapped[str] = mapped_column(String(16), nullable=False)  # AccountType
    normal_balance: Mapped[str] = mapped_column(String(8), nullable=False)  # NormalBalance

    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)  # 1/0 to keep simple
    requires_department: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    requires_store: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    requires_salesperson: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    requires_vehicle: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    requires_repair_order: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AcctPeriod(Base):
    __tablename__ = "periods"
    __table_args__ = (
        UniqueConstraint("tenant_id", "year", "month", name="uq_acct_period_tenant_ym"),
        Index("ix_acct_period_tenant_status", "tenant_id", "status"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(String(8), nullable=False, default=PeriodStatus.OPEN.value)

    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AcctJournal(Base):
    __tablename__ = "journals"
    __table_args__ = (
        Index("ix_acct_journal_tenant_date", "tenant_id", "posting_date"),
        Index("ix_acct_journal_tenant_doc", "tenant_id", "doc_type", "doc_id"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.periods.id"), nullable=False)
    batch_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("acct.posting_batches.id"), nullable=True)

    source_module: Mapped[str] = mapped_column(String(32), nullable=False)  # "MANUAL", "PARTS", "SERVICE", "SALES"
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "RO", "COUNTER", "RECEIPT", etc.
    doc_id: Mapped[str] = mapped_column(String(64), nullable=False)    # external id for drill-down

    memo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AcctJournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        Index("ix_acct_jline_tenant_acct", "tenant_id", "account_id"),
        Index("ix_acct_jline_tenant_journal", "tenant_id", "journal_id"),
        CheckConstraint("debit_cents >= 0", name="ck_acct_jline_debit_nonneg"),
        CheckConstraint("credit_cents >= 0", name="ck_acct_jline_credit_nonneg"),
        CheckConstraint("NOT (debit_cents > 0 AND credit_cents > 0)", name="ck_acct_jline_not_both"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    journal_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.journals.id"), nullable=False)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.accounts.id"), nullable=False)

    debit_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    credit_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    department: Mapped[str | None] = mapped_column(String(16), nullable=True)  # PARTS/SERVICE/SALES/FNI/ADMIN
    store: Mapped[str | None] = mapped_column(String(32), nullable=True)
    salesperson: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    repair_order_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)  # line memo / ref


class AcctPostingLock(Base):
    """
    Prevent accidental double-posting for a given business document.
    Used by future posting adapters (service/parts/sales) and can also
    protect manual posts.
    """
    __tablename__ = "posting_locks"
    __table_args__ = (
        UniqueConstraint("tenant_id", "doc_type", "doc_id", name="uq_acct_posting_lock_doc"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    doc_id: Mapped[str] = mapped_column(String(64), nullable=False)

    journal_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.journals.id"), nullable=False)

    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AcctReversalLink(Base):
    __tablename__ = "reversal_links"
    __table_args__ = (
        UniqueConstraint("tenant_id", "original_journal_id", name="uq_acct_reversal_original_once"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

    original_journal_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.journals.id"), nullable=False)
    reversal_journal_id: Mapped[str] = mapped_column(String(36), ForeignKey("acct.journals.id"), nullable=False)

    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AcctPostingBatch(Base):
    __tablename__ = "posting_batches"
    __table_args__ = (
        UniqueConstraint("tenant_id", "doc_type", "doc_id", name="uq_acct_batch_doc"),
        Index("ix_acct_batch_tenant_created", "tenant_id", "created_at"),
        Index("ix_acct_batch_tenant_status", "tenant_id", "status"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    source_module: Mapped[str] = mapped_column(String(32), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    doc_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="DRAFT")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    memo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    row_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AcctWorkflowRecord(Base):
    __tablename__ = "workflow_records"
    __table_args__ = (
        Index("ix_acct_wf_tenant_updated", "tenant_id", "updated_at"),
        Index("ix_acct_wf_tenant_type_status", "tenant_id", "workflow_type", "status"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    period_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    workflow_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_number: Mapped[str] = mapped_column(String(128), nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    employee_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    counterparty: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    notes: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    checklist: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    line_items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # cents
    commission_rate_bps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # basis points
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AcctOpsState(Base):
    __tablename__ = "ops_state"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_acct_ops_state_tenant"),
        {"schema": "acct"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    state_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
