from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal


REQUIRED_INDEXES = [
    ("acct", "ix_acct_batch_tenant_status"),
    ("acct", "ix_acct_accounts_tenant_created"),
    ("public", "ix_customers_tenant_created"),
    ("public", "ix_appts_tenant_status_start"),
    ("platform", "ux_platform_idempotency_record"),
]

REQUIRED_CONSTRAINTS = [
    ("acct", "posting_batches", "ck_acct_batch_status"),
    ("acct", "accounts", "ck_acct_account_normal_balance"),
    ("acct", "periods", "ck_acct_period_status"),
]


def main() -> None:
    db = SessionLocal()
    try:
        missing: list[str] = []

        for schema, idx in REQUIRED_INDEXES:
            ok = db.execute(
                text(
                    """
                    select 1
                    from pg_indexes
                    where schemaname = :s and indexname = :i
                    limit 1
                    """
                ),
                {"s": schema, "i": idx},
            ).scalar()
            if not ok:
                missing.append(f"index:{schema}.{idx}")

        for schema, table, con in REQUIRED_CONSTRAINTS:
            ok = db.execute(
                text(
                    """
                    select 1
                    from pg_constraint c
                    join pg_class t on t.oid = c.conrelid
                    join pg_namespace n on n.oid = t.relnamespace
                    where n.nspname = :s and t.relname = :t and c.conname = :c
                    limit 1
                    """
                ),
                {"s": schema, "t": table, "c": con},
            ).scalar()
            if not ok:
                missing.append(f"constraint:{schema}.{table}.{con}")

        if missing:
            raise SystemExit("Missing required objects: " + ", ".join(missing))
        print("OK: required constraints/indexes exist")
    finally:
        db.close()


if __name__ == "__main__":
    main()
