from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

# ---------------- Accounts ----------------

class AccountOut(BaseModel):
    id: str
    number: str
    name: str
    type: str
    normal_balance: str
    is_active: bool
    requires_department: bool = False
    requires_store: bool = False
    requires_salesperson: bool = False
    requires_vehicle: bool = False
    requires_repair_order: bool = False

    created_at: datetime
    updated_at: datetime


class AccountCreate(BaseModel):
    number: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=200)
    type: str
    normal_balance: str
    is_active: bool = True
    requires_department: bool = False
    requires_store: bool = False
    requires_salesperson: bool = False
    requires_vehicle: bool = False
    requires_repair_order: bool = False


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = None
    normal_balance: str | None = None
    is_active: bool | None = None
    requires_department: bool | None = None
    requires_store: bool | None = None
    requires_salesperson: bool | None = None
    requires_vehicle: bool | None = None
    requires_repair_order: bool | None = None


# ---------------- Periods ----------------

class PeriodOut(BaseModel):
    id: str
    year: int
    month: int
    start_date: date
    end_date: date
    status: str
    closed_at: datetime | None = None
    closed_by_user_id: str | None = None


class SeedYearResult(BaseModel):
    year: int
    created: int


# ---------------- Journals ----------------

class JournalLineIn(BaseModel):
    account_id: str
    debit_cents: int = 0
    credit_cents: int = 0
    department: str | None = None
    store: str | None = None
    salesperson: str | None = None
    vehicle_id: str | None = None
    repair_order_id: str | None = None
    reference: str | None = None


class JournalCreate(BaseModel):
    posting_date: date
    source_module: str = "MANUAL"
    doc_type: str = "MANUAL"
    doc_id: str = "MANUAL"
    memo: str | None = None
    lines: list[JournalLineIn]


class JournalLineOut(BaseModel):
    id: str
    account_id: str
    debit_cents: int
    credit_cents: int
    department: str | None = None
    store: str | None = None
    salesperson: str | None = None
    vehicle_id: str | None = None
    repair_order_id: str | None = None
    reference: str | None = None


class JournalOut(BaseModel):
    id: str
    posting_date: date
    period_id: str
    source_module: str
    doc_type: str
    doc_id: str
    memo: str | None = None
    created_at: datetime
    created_by_user_id: str | None = None
    lines: list[JournalLineOut]


# ---------------- Reports ----------------

class TrialBalanceRow(BaseModel):
    account_id: str
    account_number: str
    account_name: str
    debit_total_cents: int
    credit_total_cents: int
    net_cents: int  # debit-positive convention


class TrialBalanceOut(BaseModel):
    period_id: str | None = None
    as_of: date | None = None
    rows: list[TrialBalanceRow]


class GLDetailRow(BaseModel):
    journal_id: str
    posting_date: date
    doc_type: str
    doc_id: str
    memo: str | None
    debit_cents: int
    credit_cents: int
    department: str | None
    store: str | None = None
    salesperson: str | None = None
    vehicle_id: str | None = None
    repair_order_id: str | None = None


class GLDetailOut(BaseModel):
    account_id: str
    rows: list[GLDetailRow]


class PeriodReopenRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class BatchCreate(BaseModel):
    source_module: str = "MANUAL"
    doc_type: str = "BATCH"
    doc_id: str
    memo: str | None = None
    posting_date: date
    lines: list[JournalLineIn]


class BatchOut(BaseModel):
    id: str
    status: str
    source_module: str
    doc_type: str
    doc_id: str
    memo: str | None = None
    posting_date: date
    lines: list[JournalLineIn]
    row_version: int
    created_at: datetime
    updated_at: datetime
    posted_at: datetime | None = None
    posted_by_user_id: str | None = None


class BatchPostOut(BaseModel):
    batch: BatchOut
    journal: JournalOut


class ProfitLossRow(BaseModel):
    account_id: str
    account_number: str
    account_name: str
    account_type: str
    amount_cents: int


class ProfitLossOut(BaseModel):
    as_of: date | None = None
    period_id: str | None = None
    rows: list[ProfitLossRow]
    total_revenue_cents: int
    total_expense_cents: int
    net_income_cents: int


class BalanceSheetOut(BaseModel):
    as_of: date | None = None
    period_id: str | None = None
    assets_cents: int
    liabilities_cents: int
    equity_cents: int
    liabilities_plus_equity_cents: int


class WorkflowLineItem(BaseModel):
    id: str
    label: str = ""
    glCode: str = ""
    quantity: float = 0
    unitAmount: float = 0


class WorkflowRecordIn(BaseModel):
    periodId: str = ""
    workflowType: str
    status: str
    title: str
    referenceNumber: str
    effectiveDate: str = ""
    dueDate: str = ""
    employeeId: str = ""
    counterparty: str = ""
    notes: str = ""
    checklist: list[str] = Field(default_factory=list)
    lineItems: list[WorkflowLineItem] = Field(default_factory=list)
    taxAmount: float = 0
    commissionRate: float = 0


class WorkflowRecordOut(WorkflowRecordIn):
    id: str
    tenantId: str
    createdAt: str
    updatedAt: str


class OpsStateOut(BaseModel):
    state: dict
    updated_at: datetime | None = None


class OpsStateUpdate(BaseModel):
    state: dict


class OpsActionIn(BaseModel):
    action: str
    payload: dict = Field(default_factory=dict)


class OpsActionOut(BaseModel):
    state: dict
    action: str
    updated_at: datetime | None = None
