from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, TypedDict, cast
from uuid import uuid4

from app.core.errors import AppError
from app.modules.accounting.models import (
    AcctAccount,
    AcctJournal,
    AcctJournalLine,
    AcctPeriod,
    AcctPostingBatch,
    AcctPostingLock,
    AcctReversalLink,
    PeriodStatus,
)
from sqlalchemy import select
from sqlalchemy.orm import Session


class JournalLinePayload(TypedDict, total=False):
    account_id: str
    debit_cents: int
    credit_cents: int
    department: str
    store: str
    salesperson: str
    vehicle_id: str
    repair_order_id: str
    reference: str


def _cents_nonneg(x: int) -> None:
    if x < 0:
        raise AppError(code="acct_invalid_amount", message="Amounts must be >= 0")


def _require_open_period(period: AcctPeriod) -> None:
    if period.status != PeriodStatus.OPEN.value:
        raise AppError(code="acct_period_closed", message="Accounting period is closed")


def find_period_for_date(db: Session, tenant_id: str, d: date) -> AcctPeriod:
    q = (
        select(AcctPeriod)
        .where(
            AcctPeriod.tenant_id == tenant_id,
            AcctPeriod.start_date <= d,
            AcctPeriod.end_date >= d,
        )
        .limit(1)
    )
    period = cast(AcctPeriod | None, db.execute(q).scalar_one_or_none())
    if not period:
        raise AppError(code="acct_no_period", message=f"No accounting period covers {d.isoformat()}")
    return period


def validate_balanced(lines: list[JournalLinePayload]) -> tuple[int, int]:
    debit = 0
    credit = 0
    for ln in lines:
        d = int(ln.get("debit_cents", 0) or 0)
        c = int(ln.get("credit_cents", 0) or 0)
        _cents_nonneg(d)
        _cents_nonneg(c)
        if d > 0 and c > 0:
            raise AppError(code="acct_invalid_line", message="Line cannot have both debit and credit > 0")
        debit += d
        credit += c
    if debit != credit:
        raise AppError(code="acct_unbalanced", message=f"Unbalanced journal (debits {debit} != credits {credit})")
    return debit, credit


def create_manual_journal(
    *,
    db: Session,
    tenant_id: str,
    created_by_user_id: str | None,
    posting_date: date,
    source_module: str,
    doc_type: str,
    doc_id: str,
    memo: str | None,
    lines: list[JournalLinePayload],
    auto_commit: bool = False,
) -> AcctJournal:
    # Posting lock (idempotency for same doc_type/doc_id)
    existing_lock = cast(
        AcctPostingLock | None,
        db.execute(
        select(AcctPostingLock).where(
            AcctPostingLock.tenant_id == tenant_id,
            AcctPostingLock.doc_type == doc_type,
            AcctPostingLock.doc_id == doc_id,
        )
    ).scalar_one_or_none(),
    )
    if existing_lock:
        j = cast(AcctJournal | None, db.get(AcctJournal, existing_lock.journal_id))
        if not j:
            raise AppError(code="acct_lock_corrupt", message="Posting lock exists but journal missing")
        return j

    validate_balanced(lines)

    period = find_period_for_date(db, tenant_id, posting_date)
    _require_open_period(period)

    journal = AcctJournal(
        id=str(uuid4()),
        tenant_id=tenant_id,
        posting_date=posting_date,
        period_id=period.id,
        source_module=source_module,
        doc_type=doc_type,
        doc_id=doc_id,
        memo=memo,
        created_by_user_id=created_by_user_id,
    )
    db.add(journal)

    # Validate account ids belong to tenant
    acct_ids = [ln["account_id"] for ln in lines]
    acct_map: dict[str, AcctAccount] = {}
    if acct_ids:
        rows = cast(
            list[AcctAccount],
            db.execute(
            select(AcctAccount).where(AcctAccount.tenant_id == tenant_id, AcctAccount.id.in_(acct_ids))
        ).scalars().all(),
        )
        acct_map = {r.id: r for r in rows}
        ok = set(acct_map.keys())
        missing = [a for a in acct_ids if a not in ok]
        if missing:
            raise AppError(code="acct_account_missing", message=f"Unknown account_id(s): {missing[:10]}")
        inactive = [a.id for a in rows if not bool(a.is_active)]
        if inactive:
            raise AppError(code="acct_account_inactive", message=f"Inactive account_id(s): {inactive[:10]}")

    for ln in lines:
        acct = acct_map[ln["account_id"]]
        if bool(getattr(acct, "requires_department", 0)) and not ln.get("department"):
            raise AppError(code="acct_dimension_required", message="department is required", details={"account_id": acct.id})
        if bool(getattr(acct, "requires_store", 0)) and not ln.get("store"):
            raise AppError(code="acct_dimension_required", message="store is required", details={"account_id": acct.id})
        if bool(getattr(acct, "requires_salesperson", 0)) and not ln.get("salesperson"):
            raise AppError(code="acct_dimension_required", message="salesperson is required", details={"account_id": acct.id})
        if bool(getattr(acct, "requires_vehicle", 0)) and not ln.get("vehicle_id"):
            raise AppError(code="acct_dimension_required", message="vehicle_id is required", details={"account_id": acct.id})
        if bool(getattr(acct, "requires_repair_order", 0)) and not ln.get("repair_order_id"):
            raise AppError(code="acct_dimension_required", message="repair_order_id is required", details={"account_id": acct.id})
        db.add(
            AcctJournalLine(
                id=str(uuid4()),
                tenant_id=tenant_id,
                journal_id=journal.id,
                account_id=ln["account_id"],  # present by contract for journal lines
                debit_cents=int(ln.get("debit_cents", 0) or 0),
                credit_cents=int(ln.get("credit_cents", 0) or 0),
                department=ln.get("department"),
                store=ln.get("store"),
                salesperson=ln.get("salesperson"),
                vehicle_id=ln.get("vehicle_id"),
                repair_order_id=ln.get("repair_order_id"),
                reference=ln.get("reference"),
            )
        )

    # Create posting lock
    lock = AcctPostingLock(
        id=str(uuid4()),
        tenant_id=tenant_id,
        doc_type=doc_type,
        doc_id=doc_id,
        journal_id=journal.id,
    )
    db.add(lock)

    if auto_commit:
        db.flush()
        db.refresh(journal)
    else:
        db.flush()
    return journal


def reverse_journal(
    *,
    db: Session,
    tenant_id: str,
    created_by_user_id: str | None,
    journal_id: str,
    reason: str | None,
    auto_commit: bool = False,
) -> AcctJournal:
    original = cast(AcctJournal | None, db.get(AcctJournal, journal_id))
    if not original or original.tenant_id != tenant_id:
        raise AppError(code="acct_journal_not_found", message="Journal not found")

    existing = cast(
        AcctReversalLink | None,
        db.execute(
        select(AcctReversalLink).where(
            AcctReversalLink.tenant_id == tenant_id,
            AcctReversalLink.original_journal_id == journal_id,
        )
    ).scalar_one_or_none(),
    )
    if existing:
        j = cast(AcctJournal | None, db.get(AcctJournal, existing.reversal_journal_id))
        if not j:
            raise AppError(code="acct_reversal_corrupt", message="Reversal link exists but reversal journal missing")
        return j

    period = find_period_for_date(db, tenant_id, original.posting_date)
    _require_open_period(period)

    # Fetch lines, invert
    lines = cast(
        list[AcctJournalLine],
        db.execute(
        select(AcctJournalLine).where(
            AcctJournalLine.tenant_id == tenant_id,
            AcctJournalLine.journal_id == journal_id,
        )
    ).scalars().all(),
    )

    inv_lines: list[JournalLinePayload] = []
    for ln in lines:
        inv_lines.append(
            dict(
                account_id=ln.account_id,
                debit_cents=int(ln.credit_cents or 0),
                credit_cents=int(ln.debit_cents or 0),
                department=ln.department,
                reference=f"REVERSAL of {journal_id}",
            )
        )

    reversal = create_manual_journal(
        db=db,
        tenant_id=tenant_id,
        created_by_user_id=created_by_user_id,
        posting_date=original.posting_date,
        source_module="REVERSAL",
        doc_type="REVERSAL",
        doc_id=journal_id,
        memo=reason or f"Reversal of journal {journal_id}",
        lines=inv_lines,
        auto_commit=False,
    )

    link = AcctReversalLink(
        id=str(uuid4()),
        tenant_id=tenant_id,
        original_journal_id=journal_id,
        reversal_journal_id=reversal.id,
        reason=reason,
        created_by_user_id=created_by_user_id,
    )
    db.add(link)
    if auto_commit:
        db.flush()
        db.refresh(reversal)
    else:
        db.flush()
    return reversal


def create_batch(
    *,
    db: Session,
    tenant_id: str,
    created_by_user_id: str | None,
    source_module: str,
    doc_type: str,
    doc_id: str,
    memo: str | None,
    posting_date: date,
    lines: list[JournalLinePayload],
) -> AcctPostingBatch:
    validate_balanced(lines)
    period = find_period_for_date(db, tenant_id, posting_date)
    _require_open_period(period)

    batch = AcctPostingBatch(
        id=str(uuid4()),
        tenant_id=tenant_id,
        source_module=source_module,
        doc_type=doc_type,
        doc_id=doc_id,
        status="DRAFT",
        memo=memo,
        payload={"posting_date": posting_date.isoformat(), "lines": lines},
        created_by_user_id=created_by_user_id,
    )
    db.add(batch)
    db.flush()
    return batch


def _payload_posting_date(payload: dict[str, Any]) -> date:
    posting_date_raw = payload.get("posting_date")
    if not isinstance(posting_date_raw, str):
        raise AppError(code="acct_batch_payload_invalid", message="Invalid posting_date in batch payload")
    return date.fromisoformat(posting_date_raw)


def _payload_lines(payload: dict[str, Any]) -> list[JournalLinePayload]:
    lines_raw = payload.get("lines")
    if not isinstance(lines_raw, list):
        raise AppError(code="acct_batch_payload_invalid", message="Invalid lines in batch payload")
    if not all(isinstance(ln, dict) for ln in lines_raw):
        raise AppError(code="acct_batch_payload_invalid", message="Invalid lines in batch payload")
    return [cast(JournalLinePayload, ln) for ln in lines_raw]


def validate_batch(*, db: Session, tenant_id: str, batch_id: str, actor_id: str | None) -> AcctPostingBatch:
    batch = cast(AcctPostingBatch | None, db.get(AcctPostingBatch, batch_id))
    if not batch or batch.tenant_id != tenant_id:
        raise AppError(code="acct_batch_not_found", message="Batch not found")
    if batch.status == "POSTED":
        return batch

    payload = cast(dict[str, Any], batch.payload or {})
    posting_date = _payload_posting_date(payload)
    lines = _payload_lines(payload)
    validate_balanced(lines)
    period = find_period_for_date(db, tenant_id, posting_date)
    _require_open_period(period)

    batch.status = "VALIDATED"
    batch.validated_at = datetime.now(UTC)
    batch.validated_by_user_id = actor_id
    batch.row_version = int(batch.row_version or 1) + 1
    db.flush()
    return batch


def post_batch(
    *,
    db: Session,
    tenant_id: str,
    batch_id: str,
    actor_id: str | None,
) -> tuple[AcctPostingBatch, AcctJournal]:
    batch = cast(AcctPostingBatch | None, db.get(AcctPostingBatch, batch_id))
    if not batch or batch.tenant_id != tenant_id:
        raise AppError(code="acct_batch_not_found", message="Batch not found")

    if batch.status == "POSTED":
        existing = cast(
            AcctJournal | None,
            db.execute(
            select(AcctJournal).where(
                AcctJournal.tenant_id == tenant_id,
                AcctJournal.batch_id == batch.id,
            )
        ).scalar_one_or_none(),
        )
        if not existing:
            raise AppError(code="acct_batch_corrupt", message="Posted batch missing journal")
        return batch, existing

    validate_batch(db=db, tenant_id=tenant_id, batch_id=batch_id, actor_id=actor_id)
    payload = cast(dict[str, Any], batch.payload or {})
    posting_date = _payload_posting_date(payload)
    lines = _payload_lines(payload)

    journal = create_manual_journal(
        db=db,
        tenant_id=tenant_id,
        created_by_user_id=actor_id,
        posting_date=posting_date,
        source_module=batch.source_module,
        doc_type="BATCH",
        doc_id=batch.id,
        memo=batch.memo,
        lines=lines,
        auto_commit=False,
    )
    journal.batch_id = batch.id
    batch.status = "POSTED"
    batch.posted_at = datetime.now(UTC)
    batch.posted_by_user_id = actor_id
    batch.row_version = int(batch.row_version or 1) + 1
    db.flush()
    return batch, journal
