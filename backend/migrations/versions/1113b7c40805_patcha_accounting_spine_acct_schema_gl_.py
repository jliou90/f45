"""patchA accounting spine (acct schema + gl tables)

Revision ID: 1113b7c40805
Revises: 4f1165e66688
Create Date: 2026-02-11 20:08:59.825442

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "1113b7c40805"
down_revision: Union[str, None] = "4f1165e66688"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS acct")

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("normal_balance", sa.String(length=8), nullable=False),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "number", name="uq_acct_account_tenant_number"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_account_tenant_active",
        "accounts",
        ["tenant_id", "is_active"],
        unique=False,
        schema="acct",
    )

    op.create_table(
        "periods",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False, server_default="OPEN"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "year", "month", name="uq_acct_period_tenant_ym"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_period_tenant_status",
        "periods",
        ["tenant_id", "status"],
        unique=False,
        schema="acct",
    )

    op.create_table(
        "journals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("posting_date", sa.Date(), nullable=False),
        sa.Column("period_id", sa.String(length=36), nullable=False),
        sa.Column("source_module", sa.String(length=32), nullable=False),
        sa.Column("doc_type", sa.String(length=32), nullable=False),
        sa.Column("doc_id", sa.String(length=64), nullable=False),
        sa.Column("memo", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["acct.periods.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_journal_tenant_date",
        "journals",
        ["tenant_id", "posting_date"],
        unique=False,
        schema="acct",
    )
    op.create_index(
        "ix_acct_journal_tenant_doc",
        "journals",
        ["tenant_id", "doc_type", "doc_id"],
        unique=False,
        schema="acct",
    )

    op.create_table(
        "journal_lines",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("journal_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("debit_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credit_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("department", sa.String(length=16), nullable=True),
        sa.Column("reference", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["acct.accounts.id"]),
        sa.ForeignKeyConstraint(["journal_id"], ["acct.journals.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("debit_cents >= 0", name="ck_acct_jline_debit_nonneg"),
        sa.CheckConstraint("credit_cents >= 0", name="ck_acct_jline_credit_nonneg"),
        sa.CheckConstraint("NOT (debit_cents > 0 AND credit_cents > 0)", name="ck_acct_jline_not_both"),
        schema="acct",
    )
    op.create_index(
        "ix_acct_jline_tenant_acct",
        "journal_lines",
        ["tenant_id", "account_id"],
        unique=False,
        schema="acct",
    )
    op.create_index(
        "ix_acct_jline_tenant_journal",
        "journal_lines",
        ["tenant_id", "journal_id"],
        unique=False,
        schema="acct",
    )

    op.create_table(
        "posting_locks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("doc_type", sa.String(length=32), nullable=False),
        sa.Column("doc_id", sa.String(length=64), nullable=False),
        sa.Column("journal_id", sa.String(length=36), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["journal_id"], ["acct.journals.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "doc_type", "doc_id", name="uq_acct_posting_lock_doc"),
        schema="acct",
    )

    op.create_table(
        "reversal_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("original_journal_id", sa.String(length=36), nullable=False),
        sa.Column("reversal_journal_id", sa.String(length=36), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["original_journal_id"], ["acct.journals.id"]),
        sa.ForeignKeyConstraint(["reversal_journal_id"], ["acct.journals.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "original_journal_id", name="uq_acct_reversal_original_once"),
        schema="acct",
    )


def downgrade() -> None:
    op.drop_table("reversal_links", schema="acct")
    op.drop_table("posting_locks", schema="acct")
    op.drop_index("ix_acct_jline_tenant_journal", table_name="journal_lines", schema="acct")
    op.drop_index("ix_acct_jline_tenant_acct", table_name="journal_lines", schema="acct")
    op.drop_table("journal_lines", schema="acct")
    op.drop_index("ix_acct_journal_tenant_doc", table_name="journals", schema="acct")
    op.drop_index("ix_acct_journal_tenant_date", table_name="journals", schema="acct")
    op.drop_table("journals", schema="acct")
    op.drop_index("ix_acct_period_tenant_status", table_name="periods", schema="acct")
    op.drop_table("periods", schema="acct")
    op.drop_index("ix_acct_account_tenant_active", table_name="accounts", schema="acct")
    op.drop_table("accounts", schema="acct")
    op.execute("DROP SCHEMA IF EXISTS acct")
