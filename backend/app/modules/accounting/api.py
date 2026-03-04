from __future__ import annotations

from calendar import monthrange
from datetime import date
from typing import Any
from typing import cast as type_cast
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import (
    finalize_idempotent_request,
    idempotency_guard,
    start_idempotent_request,
)
from app.core.pagination import PageResult
from app.core.paging import paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.tenancy.deps import get_current_tenant, require_tenant_role
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.accounting.models import (
    AcctAccount,
    AcctJournal,
    AcctJournalLine,
    AcctPeriod,
    AcctPostingBatch,
    PeriodStatus,
)
from app.modules.accounting.schemas import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    BalanceSheetOut,
    BatchCreate,
    BatchOut,
    BatchPostOut,
    GLDetailOut,
    GLDetailRow,
    JournalCreate,
    JournalLineOut,
    JournalOut,
    PeriodOut,
    PeriodReopenRequest,
    ProfitLossOut,
    ProfitLossRow,
    SeedYearResult,
    TrialBalanceOut,
    TrialBalanceRow,
)
from app.modules.accounting.service import (
    create_batch,
    create_manual_journal,
    post_batch,
    reverse_journal,
    validate_batch,
)
from app.modules.audit.service import log_audit_event
from app.modules.tenancy.models import Tenant
from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session

router = APIRouter(prefix="/acct")

# ---------- Accounts ----------

@router.get("/accounts", response_model=PageResult[AccountOut])
def list_accounts(
    q: str | None = Query(default=None, description="Optional search by account number or name"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id
    qry = db.query(AcctAccount).filter(AcctAccount.tenant_id == tid)
    if q and q.strip():
        like = f"%{q.strip()}%"
        qry = qry.filter((AcctAccount.number.ilike(like)) | (AcctAccount.name.ilike(like)))

    if sort.fields:
        qry = apply_sort(
            qry,
            AcctAccount,
            sort,
            allowed={"number", "name", "type", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(AcctAccount.number.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda a: AccountOut(
            id=a.id,
            number=a.number,
            name=a.name,
            type=a.type,
            normal_balance=a.normal_balance,
            is_active=bool(a.is_active),
            requires_department=bool(getattr(a, "requires_department", 0)),
            requires_store=bool(getattr(a, "requires_store", 0)),
            requires_salesperson=bool(getattr(a, "requires_salesperson", 0)),
            requires_vehicle=bool(getattr(a, "requires_vehicle", 0)),
            requires_repair_order=bool(getattr(a, "requires_repair_order", 0)),
            created_at=a.created_at,
            updated_at=a.updated_at,
        ),
    )


@router.post("/accounts", response_model=AccountOut)
def create_account(
    payload: AccountCreate,
    uow: UnitOfWork = Depends(get_uow),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        a = AcctAccount(
            id=str(uuid4()),
            tenant_id=tid,
            number=payload.number,
            name=payload.name,
            type=payload.type,
            normal_balance=payload.normal_balance,
            is_active=1 if payload.is_active else 0,
            requires_department=1 if payload.requires_department else 0,
            requires_store=1 if payload.requires_store else 0,
            requires_salesperson=1 if payload.requires_salesperson else 0,
            requires_vehicle=1 if payload.requires_vehicle else 0,
            requires_repair_order=1 if payload.requires_repair_order else 0,
        )
        db.add(a)
        db.flush()
        db.refresh(a)
        return AccountOut(
            id=a.id,
            number=a.number,
            name=a.name,
            type=a.type,
            normal_balance=a.normal_balance,
            is_active=bool(a.is_active),
            requires_department=bool(getattr(a, "requires_department", 0)),
            requires_store=bool(getattr(a, "requires_store", 0)),
            requires_salesperson=bool(getattr(a, "requires_salesperson", 0)),
            requires_vehicle=bool(getattr(a, "requires_vehicle", 0)),
            requires_repair_order=bool(getattr(a, "requires_repair_order", 0)),
            created_at=a.created_at,
            updated_at=a.updated_at,
        )


@router.patch("/accounts/{account_id}", response_model=AccountOut)
def update_account(
    account_id: str,
    payload: AccountUpdate,
    uow: UnitOfWork = Depends(get_uow),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        a = db.get(AcctAccount, account_id)
        if not a or a.tenant_id != tid:
            raise AppError(code="acct_account_not_found", message="Account not found")

        if payload.name is not None:
            a.name = payload.name
        if payload.type is not None:
            a.type = payload.type
        if payload.normal_balance is not None:
            a.normal_balance = payload.normal_balance
        if payload.is_active is not None:
            a.is_active = 1 if payload.is_active else 0
        if payload.requires_department is not None:
            a.requires_department = 1 if payload.requires_department else 0
        if payload.requires_store is not None:
            a.requires_store = 1 if payload.requires_store else 0
        if payload.requires_salesperson is not None:
            a.requires_salesperson = 1 if payload.requires_salesperson else 0
        if payload.requires_vehicle is not None:
            a.requires_vehicle = 1 if payload.requires_vehicle else 0
        if payload.requires_repair_order is not None:
            a.requires_repair_order = 1 if payload.requires_repair_order else 0

        db.flush()
        db.refresh(a)
        return AccountOut(
            id=a.id,
            number=a.number,
            name=a.name,
            type=a.type,
            normal_balance=a.normal_balance,
            is_active=bool(a.is_active),
            requires_department=bool(getattr(a, "requires_department", 0)),
            requires_store=bool(getattr(a, "requires_store", 0)),
            requires_salesperson=bool(getattr(a, "requires_salesperson", 0)),
            requires_vehicle=bool(getattr(a, "requires_vehicle", 0)),
            requires_repair_order=bool(getattr(a, "requires_repair_order", 0)),
            created_at=a.created_at,
            updated_at=a.updated_at,
        )


# ---------- Periods ----------

@router.get("/periods", response_model=PageResult[PeriodOut])
def list_periods(
    q: str | None = Query(default=None, description="Optional search by year-month, e.g. 2026-01"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id
    qry = db.query(AcctPeriod).filter(AcctPeriod.tenant_id == tid)
    if q and q.strip():
        like = f"%{q.strip()}%"
        qry = qry.filter(
            (cast(AcctPeriod.year, String).ilike(like))
            | (cast(AcctPeriod.month, String).ilike(like))
        )

    if sort.fields:
        qry = apply_sort(
            qry,
            AcctPeriod,
            sort,
            allowed={"year", "month", "start_date", "end_date", "status"},
        )
    else:
        qry = qry.order_by(AcctPeriod.year.asc(), AcctPeriod.month.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda p: PeriodOut(
            id=p.id,
            year=p.year,
            month=p.month,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
            closed_at=p.closed_at,
            closed_by_user_id=p.closed_by_user_id,
        ),
    )


@router.post("/periods/seed-year", response_model=SeedYearResult)
def seed_year(
    year: int = Query(..., ge=2000, le=2100),
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id

    created = 0
    with uow as db:
        for m in range(1, 13):
            exists = db.execute(
                select(AcctPeriod.id).where(AcctPeriod.tenant_id == tid, AcctPeriod.year == year, AcctPeriod.month == m)
            ).scalar_one_or_none()
            if exists:
                continue

            last_day = monthrange(year, m)[1]
            p = AcctPeriod(
                id=str(uuid4()),
                tenant_id=tid,
                year=year,
                month=m,
                start_date=date(year, m, 1),
                end_date=date(year, m, last_day),
                status=PeriodStatus.OPEN.value,
            )
            db.add(p)
            created += 1

    return SeedYearResult(year=year, created=created)


@router.post("/periods/{period_id}/close", response_model=PeriodOut)
def close_period(
    period_id: str,
    reason: str | None = None,
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        p = db.get(AcctPeriod, period_id)
        if not p or p.tenant_id != tid:
            raise AppError(code="acct_period_not_found", message="Period not found")

        p.status = PeriodStatus.CLOSED.value
        p.closed_at = func.now()
        p.closed_by_user_id = u.id
        log_audit_event(
            db=db,
            tenant_id=tid,
            actor_id=u.id,
            action="accounting.period.closed",
            entity_type="acct_period",
            entity_id=p.id,
            reason=reason,
            after={"status": p.status},
        )
        db.flush()
        db.refresh(p)
        return PeriodOut(
            id=p.id,
            year=p.year,
            month=p.month,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
            closed_at=p.closed_at,
            closed_by_user_id=p.closed_by_user_id,
        )


@router.post("/periods/{period_id}/open", response_model=PeriodOut)
def open_period(
    period_id: str,
    payload: PeriodReopenRequest,
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _role=Depends(require_tenant_role("ADMIN")),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        p = db.get(AcctPeriod, period_id)
        if not p or p.tenant_id != tid:
            raise AppError(code="acct_period_not_found", message="Period not found")

        p.status = PeriodStatus.OPEN.value
        p.closed_at = None
        p.closed_by_user_id = None
        log_audit_event(
            db=db,
            tenant_id=tid,
            actor_id=u.id,
            action="accounting.period.reopened",
            entity_type="acct_period",
            entity_id=p.id,
            reason=payload.reason,
            after={"status": p.status},
        )
        db.flush()
        db.refresh(p)
        return PeriodOut(
            id=p.id,
            year=p.year,
            month=p.month,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
            closed_at=p.closed_at,
            closed_by_user_id=p.closed_by_user_id,
        )


# ---------- Journals (manual) ----------

@router.post("/journals", response_model=JournalOut)
def create_journal(
    payload: JournalCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tid,
            actor_id=u.id,
            endpoint_key="acct.journals.create",
            idempotency_key=idempotency_key,
            request_payload=payload.model_dump(mode="json"),
        )
        if idmp.replay is not None:
            return JournalOut.model_validate(idmp.replay)

        j = create_manual_journal(
            db=db,
            tenant_id=tid,
            created_by_user_id=u.id,
            posting_date=payload.posting_date,
            source_module=payload.source_module,
            doc_type=payload.doc_type,
            doc_id=payload.doc_id,
            memo=payload.memo,
            lines=[ln.model_dump() for ln in payload.lines],
            auto_commit=False,
        )
        log_audit_event(
            db=db,
            tenant_id=tid,
            actor_id=u.id,
            action="accounting.journal.posted",
            entity_type="acct_journal",
            entity_id=j.id,
            metadata={
                "source_module": payload.source_module,
                "doc_type": payload.doc_type,
                "doc_id": payload.doc_id,
                "line_count": len(payload.lines),
            },
        )
        lines = db.execute(
            select(AcctJournalLine).where(AcctJournalLine.tenant_id == tid, AcctJournalLine.journal_id == j.id)
        ).scalars().all()

        out = JournalOut(
            id=j.id,
            posting_date=j.posting_date,
            period_id=j.period_id,
            source_module=j.source_module,
            doc_type=j.doc_type,
            doc_id=j.doc_id,
            memo=j.memo,
            created_at=j.created_at,
            created_by_user_id=j.created_by_user_id,
            lines=[
                JournalLineOut(
                    id=ln.id,
                    account_id=ln.account_id,
                    debit_cents=ln.debit_cents,
                    credit_cents=ln.credit_cents,
                    department=ln.department,
                    store=ln.store,
                    salesperson=ln.salesperson,
                    vehicle_id=ln.vehicle_id,
                    repair_order_id=ln.repair_order_id,
                    reference=ln.reference,
                )
                for ln in lines
            ],
        )
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="acct_journal",
            resource_id=out.id,
        )
        return out


@router.post("/journals/{journal_id}/reverse", response_model=JournalOut)
def reverse(
    journal_id: str,
    reason: str | None = None,
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    tid = tenant.id
    with uow as db:
        j = reverse_journal(db=db, tenant_id=tid, created_by_user_id=u.id, journal_id=journal_id, reason=reason, auto_commit=False)
        log_audit_event(
            db=db,
            tenant_id=tid,
            actor_id=u.id,
            action="accounting.journal.reversed",
            entity_type="acct_journal",
            entity_id=j.id,
            reason=reason,
            metadata={"original_journal_id": journal_id},
        )

        lines = db.execute(
            select(AcctJournalLine).where(AcctJournalLine.tenant_id == tid, AcctJournalLine.journal_id == j.id)
        ).scalars().all()

        return JournalOut(
            id=j.id,
            posting_date=j.posting_date,
            period_id=j.period_id,
            source_module=j.source_module,
            doc_type=j.doc_type,
            doc_id=j.doc_id,
            memo=j.memo,
            created_at=j.created_at,
            created_by_user_id=j.created_by_user_id,
            lines=[
                JournalLineOut(
                    id=ln.id,
                    account_id=ln.account_id,
                    debit_cents=ln.debit_cents,
                    credit_cents=ln.credit_cents,
                    department=ln.department,
                    store=ln.store,
                    salesperson=ln.salesperson,
                    vehicle_id=ln.vehicle_id,
                    repair_order_id=ln.repair_order_id,
                    reference=ln.reference,
                )
                for ln in lines
            ],
        )


# ---------- Reports ----------

@router.get("/reports/trial-balance", response_model=TrialBalanceOut)
def trial_balance(
    period_id: str | None = None,
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id

    j_filter = [AcctJournal.tenant_id == tid]
    if period_id:
        j_filter.append(AcctJournal.period_id == period_id)
    if as_of:
        j_filter.append(AcctJournal.posting_date <= as_of)

    q = (
        select(
            AcctAccount.id.label("account_id"),
            AcctAccount.number,
            AcctAccount.name,
            func.coalesce(func.sum(AcctJournalLine.debit_cents), 0).label("debit_total"),
            func.coalesce(func.sum(AcctJournalLine.credit_cents), 0).label("credit_total"),
        )
        .select_from(AcctJournalLine)
        .join(AcctJournal, AcctJournal.id == AcctJournalLine.journal_id)
        .join(AcctAccount, AcctAccount.id == AcctJournalLine.account_id)
        .where(*j_filter)
        .group_by(AcctAccount.id, AcctAccount.number, AcctAccount.name)
        .order_by(AcctAccount.number.asc())
    )

    rows = db.execute(q).all()
    out_rows = []
    for r in rows:
        debit = int(r.debit_total)
        credit = int(r.credit_total)
        out_rows.append(
            TrialBalanceRow(
                account_id=r.account_id,
                account_number=r.number,
                account_name=r.name,
                debit_total_cents=debit,
                credit_total_cents=credit,
                net_cents=debit - credit,
            )
        )

    return TrialBalanceOut(period_id=period_id, as_of=as_of, rows=out_rows)


@router.get("/reports/gl-detail/{account_id}", response_model=GLDetailOut)
def gl_detail(
    account_id: str,
    period_id: str | None = None,
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id

    j_filter = [
        AcctJournalLine.tenant_id == tid,
        AcctJournalLine.account_id == account_id,
    ]
    if period_id:
        j_filter.append(AcctJournal.period_id == period_id)

    q = (
        select(
            AcctJournalLine.journal_id,
            AcctJournal.posting_date,
            AcctJournal.doc_type,
            AcctJournal.doc_id,
            AcctJournal.memo,
            AcctJournalLine.debit_cents,
            AcctJournalLine.credit_cents,
            AcctJournalLine.department,
            AcctJournalLine.store,
            AcctJournalLine.salesperson,
            AcctJournalLine.vehicle_id,
            AcctJournalLine.repair_order_id,
        )
        .select_from(AcctJournalLine)
        .join(AcctJournal, AcctJournal.id == AcctJournalLine.journal_id)
        .where(*j_filter)
        .order_by(AcctJournal.posting_date.asc(), AcctJournalLine.journal_id.asc())
    )

    rows = db.execute(q).all()
    return GLDetailOut(
        account_id=account_id,
        rows=[
            GLDetailRow(
                journal_id=r.journal_id,
                posting_date=r.posting_date,
                doc_type=r.doc_type,
                doc_id=r.doc_id,
                memo=r.memo,
                debit_cents=int(r.debit_cents),
                credit_cents=int(r.credit_cents),
                department=r.department,
                store=r.store,
                salesperson=r.salesperson,
                vehicle_id=r.vehicle_id,
                repair_order_id=r.repair_order_id,
            )
            for r in rows
        ],
    )


def _batch_out(batch: AcctPostingBatch) -> BatchOut:
    payload = batch.payload or {}
    payload_dict = payload if isinstance(payload, dict) else {}
    payload_dict = type_cast(dict[str, Any], payload_dict)
    posting_date_raw = payload_dict.get("posting_date")
    if not isinstance(posting_date_raw, str):
        raise AppError(code="acct_batch_payload_invalid", message="Invalid posting_date in batch payload")
    lines_raw = payload_dict.get("lines")
    if not isinstance(lines_raw, list):
        raise AppError(code="acct_batch_payload_invalid", message="Invalid lines in batch payload")
    return BatchOut(
        id=batch.id,
        status=batch.status,
        source_module=batch.source_module,
        doc_type=batch.doc_type,
        doc_id=batch.doc_id,
        memo=batch.memo,
        posting_date=date.fromisoformat(posting_date_raw),
        lines=type_cast(list[dict[str, Any]], lines_raw),
        row_version=int(batch.row_version or 1),
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        posted_at=batch.posted_at,
        posted_by_user_id=batch.posted_by_user_id,
    )


@router.post("/batches", response_model=BatchOut)
def create_posting_batch(
    payload: BatchCreate,
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        b = create_batch(
            db=db,
            tenant_id=tenant.id,
            created_by_user_id=u.id,
            source_module=payload.source_module,
            doc_type=payload.doc_type,
            doc_id=payload.doc_id,
            memo=payload.memo,
            posting_date=payload.posting_date,
            lines=[ln.model_dump() for ln in payload.lines],
        )
        db.flush()
        db.refresh(b)
        return _batch_out(b)


@router.post("/batches/{batch_id}/validate", response_model=BatchOut)
def validate_posting_batch(
    batch_id: str,
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        b = validate_batch(db=db, tenant_id=tenant.id, batch_id=batch_id, actor_id=u.id)
        db.flush()
        db.refresh(b)
        return _batch_out(b)


@router.post("/batches/{batch_id}/post", response_model=BatchPostOut)
def post_posting_batch(
    batch_id: str,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    uow: UnitOfWork = Depends(get_uow),
    u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_WRITE)),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        idmp = start_idempotent_request(
            db=db,
            tenant_id=tenant.id,
            actor_id=u.id,
            endpoint_key="acct.batches.post",
            idempotency_key=idempotency_key,
            request_payload={"batch_id": batch_id},
        )
        if idmp.replay is not None:
            return BatchPostOut.model_validate(idmp.replay)

        b, j = post_batch(db=db, tenant_id=tenant.id, batch_id=batch_id, actor_id=u.id)
        lines = db.execute(
            select(AcctJournalLine).where(AcctJournalLine.tenant_id == tenant.id, AcctJournalLine.journal_id == j.id)
        ).scalars().all()
        journal_out = JournalOut(
            id=j.id,
            posting_date=j.posting_date,
            period_id=j.period_id,
            source_module=j.source_module,
            doc_type=j.doc_type,
            doc_id=j.doc_id,
            memo=j.memo,
            created_at=j.created_at,
            created_by_user_id=j.created_by_user_id,
            lines=[
                JournalLineOut(
                    id=ln.id,
                    account_id=ln.account_id,
                    debit_cents=ln.debit_cents,
                    credit_cents=ln.credit_cents,
                    department=ln.department,
                    store=ln.store,
                    salesperson=ln.salesperson,
                    vehicle_id=ln.vehicle_id,
                    repair_order_id=ln.repair_order_id,
                    reference=ln.reference,
                )
                for ln in lines
            ],
        )
        out = BatchPostOut(batch=_batch_out(b), journal=journal_out)
        finalize_idempotent_request(
            record=idmp.record,
            status_code=200,
            response_json=out.model_dump(mode="json"),
            resource_type="acct_batch",
            resource_id=b.id,
        )
        return out


@router.get("/reports/profit-loss", response_model=ProfitLossOut)
def profit_loss(
    period_id: str | None = None,
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id
    j_filter = [AcctJournal.tenant_id == tid]
    if period_id:
        j_filter.append(AcctJournal.period_id == period_id)
    if as_of:
        j_filter.append(AcctJournal.posting_date <= as_of)
    q = (
        select(
            AcctAccount.id.label("account_id"),
            AcctAccount.number,
            AcctAccount.name,
            AcctAccount.type.label("account_type"),
            (func.coalesce(func.sum(AcctJournalLine.credit_cents), 0) - func.coalesce(func.sum(AcctJournalLine.debit_cents), 0)).label("amount"),
        )
        .select_from(AcctJournalLine)
        .join(AcctJournal, AcctJournal.id == AcctJournalLine.journal_id)
        .join(AcctAccount, AcctAccount.id == AcctJournalLine.account_id)
        .where(*j_filter, AcctAccount.type.in_(["REVENUE", "EXPENSE"]))
        .group_by(AcctAccount.id, AcctAccount.number, AcctAccount.name, AcctAccount.type)
        .order_by(AcctAccount.number.asc())
    )
    rows = db.execute(q).all()
    out_rows = [
        ProfitLossRow(
            account_id=r.account_id,
            account_number=r.number,
            account_name=r.name,
            account_type=r.account_type,
            amount_cents=int(r.amount),
        )
        for r in rows
    ]
    rev = sum(r.amount_cents for r in out_rows if r.account_type == "REVENUE")
    exp = -sum(r.amount_cents for r in out_rows if r.account_type == "EXPENSE")
    return ProfitLossOut(
        as_of=as_of,
        period_id=period_id,
        rows=out_rows,
        total_revenue_cents=rev,
        total_expense_cents=exp,
        net_income_cents=rev - exp,
    )


@router.get("/reports/balance-sheet", response_model=BalanceSheetOut)
def balance_sheet(
    period_id: str | None = None,
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _u=Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    _perm=Depends(require_permission(Permission.ACCOUNTING_READ)),
):
    tid = tenant.id
    j_filter = [AcctJournal.tenant_id == tid]
    if period_id:
        j_filter.append(AcctJournal.period_id == period_id)
    if as_of:
        j_filter.append(AcctJournal.posting_date <= as_of)

    q = (
        select(
            AcctAccount.type.label("account_type"),
            (func.coalesce(func.sum(AcctJournalLine.debit_cents), 0) - func.coalesce(func.sum(AcctJournalLine.credit_cents), 0)).label("amount"),
        )
        .select_from(AcctJournalLine)
        .join(AcctJournal, AcctJournal.id == AcctJournalLine.journal_id)
        .join(AcctAccount, AcctAccount.id == AcctJournalLine.account_id)
        .where(*j_filter, AcctAccount.type.in_(["ASSET", "LIABILITY", "EQUITY"]))
        .group_by(AcctAccount.type)
    )
    rows = {r.account_type: int(r.amount) for r in db.execute(q).all()}
    assets = rows.get("ASSET", 0)
    liabilities = -rows.get("LIABILITY", 0)
    equity = -rows.get("EQUITY", 0)
    return BalanceSheetOut(
        as_of=as_of,
        period_id=period_id,
        assets_cents=assets,
        liabilities_cents=liabilities,
        equity_cents=equity,
        liabilities_plus_equity_cents=liabilities + equity,
    )
