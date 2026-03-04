"""patchA.1 accounting hardening (immutability, balance, batches, projection, dimensions)

Revision ID: 39a9bb3e30c6
Revises: 1113b7c40805
Create Date: 2026-02-11 20:25:08.535056

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '39a9bb3e30c6'
down_revision: Union[str, None] = '1113b7c40805'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # 1) Add columns / tables
    op.add_column(
        "accounts",
        sa.Column("requires_department", sa.Integer(), nullable=False, server_default="0"),
        schema="acct",
    )

    op.create_table(
        "posting_batches",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("source_module", sa.String(length=32), nullable=False),
        sa.Column("doc_type", sa.String(length=32), nullable=False),
        sa.Column("doc_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="POSTED"),  # POSTED/REVERSED
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "doc_type", "doc_id", name="uq_acct_batch_doc"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_batch_tenant_created",
        "posting_batches",
        ["tenant_id", "created_at"],
        unique=False,
        schema="acct",
    )

    op.add_column(
        "journals",
        sa.Column("batch_id", sa.String(length=36), nullable=True),
        schema="acct",
    )
    op.create_foreign_key(
        "fk_acct_journals_batch",
        source_table="journals",
        referent_table="posting_batches",
        local_cols=["batch_id"],
        remote_cols=["id"],
        source_schema="acct",
        referent_schema="acct",
    )
    op.create_index(
        "ix_acct_journal_tenant_batch",
        "journals",
        ["tenant_id", "batch_id"],
        unique=False,
        schema="acct",
    )

    op.create_table(
        "account_balances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("period_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("debit_total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credit_total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["period_id"], ["acct.periods.id"]),
        sa.ForeignKeyConstraint(["account_id"], ["acct.accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "period_id", "account_id", name="uq_acct_balance_tenant_period_account"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_bal_tenant_period",
        "account_balances",
        ["tenant_id", "period_id"],
        unique=False,
        schema="acct",
    )

    # 2) DB functions + triggers (immutability, balance, period validity)
    # -- Immutable guard
    op.execute(
        """
        CREATE OR REPLACE FUNCTION acct.fn_block_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'Immutable table: %', TG_TABLE_NAME;
        END;
        $$;
        """
    )

    # block UPDATE/DELETE on journals/lines/locks/reversals (audit-grade immutability)
    for table in ["journals", "journal_lines", "posting_locks", "reversal_links"]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_block_{table}_upd ON acct.{table};")
        op.execute(f"DROP TRIGGER IF EXISTS trg_block_{table}_del ON acct.{table};")
        op.execute(
            f"""
            CREATE TRIGGER trg_block_{table}_upd
            BEFORE UPDATE ON acct.{table}
            FOR EACH ROW
            EXECUTE FUNCTION acct.fn_block_mutation();
            """
        )
        op.execute(
            f"""
            CREATE TRIGGER trg_block_{table}_del
            BEFORE DELETE ON acct.{table}
            FOR EACH ROW
            EXECUTE FUNCTION acct.fn_block_mutation();
            """
        )

    # -- Validate journal period & open status at insert
    op.execute(
        """
        CREATE OR REPLACE FUNCTION acct.fn_validate_journal_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          p_start date;
          p_end date;
          p_status text;
        BEGIN
          SELECT start_date, end_date, status
            INTO p_start, p_end, p_status
          FROM acct.periods
          WHERE id = NEW.period_id AND tenant_id = NEW.tenant_id;

          IF p_start IS NULL THEN
            RAISE EXCEPTION 'Invalid period_id %', NEW.period_id;
          END IF;

          IF NEW.posting_date < p_start OR NEW.posting_date > p_end THEN
            RAISE EXCEPTION 'posting_date % outside period % (% to %)', NEW.posting_date, NEW.period_id, p_start, p_end;
          END IF;

          IF p_status <> 'OPEN' THEN
            RAISE EXCEPTION 'Cannot post into CLOSED period %', NEW.period_id;
          END IF;

          RETURN NEW;
        END;
        $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_validate_journal_insert ON acct.journals;")
    op.execute(
        """
        CREATE TRIGGER trg_validate_journal_insert
        BEFORE INSERT ON acct.journals
        FOR EACH ROW
        EXECUTE FUNCTION acct.fn_validate_journal_insert();
        """
    )

    # -- Balanced journal check at commit-time (deferred constraint trigger)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION acct.fn_assert_journal_balanced()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          j_id text;
          s_debit bigint;
          s_credit bigint;
        BEGIN
          j_id := COALESCE(NEW.journal_id, OLD.journal_id);

          SELECT COALESCE(SUM(debit_cents),0), COALESCE(SUM(credit_cents),0)
            INTO s_debit, s_credit
          FROM acct.journal_lines
          WHERE journal_id = j_id;

          IF s_debit <> s_credit THEN
            RAISE EXCEPTION 'Unbalanced journal % (debit=% credit=%)', j_id, s_debit, s_credit;
          END IF;

          RETURN NULL;
        END;
        $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_assert_balanced_lines ON acct.journal_lines;")
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER trg_assert_balanced_lines
        AFTER INSERT OR UPDATE OR DELETE ON acct.journal_lines
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION acct.fn_assert_journal_balanced();
        """
    )

    # 3) Projection maintenance (balances table) – simple single-rooftop approach
    # We update balances after journal_lines insert, deferred so it runs at commit.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION acct.fn_apply_balances()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          tid text;
          pid text;
          aid text;
          did bigint;
          cid bigint;
          bal_id text;
        BEGIN
          tid := NEW.tenant_id;
          aid := NEW.account_id;

          SELECT period_id INTO pid FROM acct.journals WHERE id = NEW.journal_id;
          IF pid IS NULL THEN
            RAISE EXCEPTION 'Journal % not found for line', NEW.journal_id;
          END IF;

          did := COALESCE(NEW.debit_cents,0);
          cid := COALESCE(NEW.credit_cents,0);

          -- upsert balance row
          SELECT id INTO bal_id
          FROM acct.account_balances
          WHERE tenant_id = tid AND period_id = pid AND account_id = aid;

          IF bal_id IS NULL THEN
            INSERT INTO acct.account_balances(id, tenant_id, period_id, account_id, debit_total_cents, credit_total_cents, updated_at)
            VALUES (gen_random_uuid()::text, tid, pid, aid, did, cid, now());
          ELSE
            UPDATE acct.account_balances
              SET debit_total_cents = debit_total_cents + did,
                  credit_total_cents = credit_total_cents + cid,
                  updated_at = now()
            WHERE id = bal_id;
          END IF;

          RETURN NULL;
        END;
        $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_apply_balances ON acct.journal_lines;")
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER trg_apply_balances
        AFTER INSERT ON acct.journal_lines
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION acct.fn_apply_balances();
        """
    )

    # NOTE: gen_random_uuid requires pgcrypto. If you don't have it enabled:
    # op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    # Put that at the top if needed.


def downgrade() -> None:
    # Drop triggers/functions in reverse order
    op.execute("DROP TRIGGER IF EXISTS trg_apply_balances ON acct.journal_lines;")
    op.execute("DROP FUNCTION IF EXISTS acct.fn_apply_balances();")

    op.execute("DROP TRIGGER IF EXISTS trg_assert_balanced_lines ON acct.journal_lines;")
    op.execute("DROP FUNCTION IF EXISTS acct.fn_assert_journal_balanced();")

    op.execute("DROP TRIGGER IF EXISTS trg_validate_journal_insert ON acct.journals;")
    op.execute("DROP FUNCTION IF EXISTS acct.fn_validate_journal_insert();")

    for table in ["journals", "journal_lines", "posting_locks", "reversal_links"]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_block_{table}_upd ON acct.{table};")
        op.execute(f"DROP TRIGGER IF EXISTS trg_block_{table}_del ON acct.{table};")

    op.execute("DROP FUNCTION IF EXISTS acct.fn_block_mutation();")

    op.drop_index("ix_acct_bal_tenant_period", table_name="account_balances", schema="acct")
    op.drop_table("account_balances", schema="acct")

    op.drop_index("ix_acct_journal_tenant_batch", table_name="journals", schema="acct")
    op.drop_constraint("fk_acct_journals_batch", "journals", schema="acct", type_="foreignkey")
    op.drop_column("journals", "batch_id", schema="acct")

    op.drop_index("ix_acct_batch_tenant_created", table_name="posting_batches", schema="acct")
    op.drop_table("posting_batches", schema="acct")

    op.drop_column("accounts", "requires_department", schema="acct")
