"""patchA.5/A.6/A.10 hardening (constraints, idempotency replay, dimensions)

Revision ID: d9e1f8a2c4b7
Revises: c1d7e2a4b9f0
Create Date: 2026-02-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d9e1f8a2c4b7"
down_revision: Union[str, None] = "c1d7e2a4b9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, schema: str, table: str, column: str) -> bool:
    return conn.execute(
        sa.text(
            """
            select 1
            from information_schema.columns
            where table_schema = :s and table_name = :t and column_name = :c
            limit 1
            """
        ),
        {"s": schema, "t": table, "c": column},
    ).scalar() is not None


def _has_index(conn, schema: str, index_name: str) -> bool:
    return conn.execute(
        sa.text(
            """
            select 1
            from pg_indexes
            where schemaname = :s and indexname = :i
            limit 1
            """
        ),
        {"s": schema, "i": index_name},
    ).scalar() is not None


def _has_constraint(conn, schema: str, table: str, constraint_name: str) -> bool:
    return conn.execute(
        sa.text(
            """
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = :s and t.relname = :t and c.conname = :c
            limit 1
            """
        ),
        {"s": schema, "t": table, "c": constraint_name},
    ).scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    op.execute("CREATE SCHEMA IF NOT EXISTS platform")

    if not conn.execute(sa.text("select to_regclass('platform.idempotency_records')")).scalar():
        op.create_table(
            "idempotency_records",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("actor_scope", sa.String(length=36), nullable=False, server_default=""),
            sa.Column("endpoint_key", sa.String(length=120), nullable=False),
            sa.Column("idempotency_key", sa.String(length=200), nullable=False),
            sa.Column("request_hash", sa.String(length=64), nullable=False),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("response_json", sa.JSON(), nullable=True),
            sa.Column("resource_type", sa.String(length=60), nullable=True),
            sa.Column("resource_id", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            schema="platform",
        )
    if not _has_index(conn, "platform", "ux_platform_idempotency_record"):
        op.create_index(
            "ux_platform_idempotency_record",
            "idempotency_records",
            ["tenant_id", "actor_scope", "endpoint_key", "idempotency_key"],
            unique=True,
            schema="platform",
        )
    if not _has_index(conn, "platform", "ix_platform_idempotency_record_tenant_created"):
        op.create_index(
            "ix_platform_idempotency_record_tenant_created",
            "idempotency_records",
            ["tenant_id", "created_at"],
            unique=False,
            schema="platform",
        )

    for col in ("requires_store", "requires_salesperson", "requires_vehicle", "requires_repair_order"):
        if not _has_column(conn, "acct", "accounts", col):
            op.add_column("accounts", sa.Column(col, sa.Integer(), nullable=False, server_default="0"), schema="acct")
            op.alter_column("accounts", col, server_default=None, schema="acct")

    if not _has_index(conn, "acct", "ix_acct_accounts_tenant_created"):
        op.create_index("ix_acct_accounts_tenant_created", "accounts", ["tenant_id", "created_at"], schema="acct")

    for col, typ in (
        ("store", sa.String(length=32)),
        ("salesperson", sa.String(length=64)),
        ("vehicle_id", sa.String(length=36)),
        ("repair_order_id", sa.String(length=36)),
    ):
        if not _has_column(conn, "acct", "journal_lines", col):
            op.add_column("journal_lines", sa.Column(col, typ, nullable=True), schema="acct")

    if not _has_index(conn, "acct", "ix_acct_jline_tenant_created"):
        op.create_index("ix_acct_jline_tenant_created", "journal_lines", ["tenant_id", "id"], schema="acct")
    if not _has_index(conn, "acct", "ix_acct_jline_tenant_dept_store"):
        op.create_index("ix_acct_jline_tenant_dept_store", "journal_lines", ["tenant_id", "department", "store"], schema="acct")

    if _has_column(conn, "acct", "posting_batches", "status"):
        op.execute(
            sa.text(
                """
                UPDATE acct.posting_batches
                SET status = 'POSTED'
                WHERE status IS NULL OR status = ''
                """
            )
        )
    if not _has_column(conn, "acct", "posting_batches", "payload"):
        op.add_column(
            "posting_batches",
            sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
            schema="acct",
        )
        op.alter_column("posting_batches", "payload", server_default=None, schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "memo"):
        op.add_column("posting_batches", sa.Column("memo", sa.String(length=500), nullable=True), schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "row_version"):
        op.add_column("posting_batches", sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"), schema="acct")
        op.alter_column("posting_batches", "row_version", server_default=None, schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "updated_at"):
        op.add_column("posting_batches", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")), schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "validated_at"):
        op.add_column("posting_batches", sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True), schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "validated_by_user_id"):
        op.add_column("posting_batches", sa.Column("validated_by_user_id", sa.String(length=36), nullable=True), schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "posted_at"):
        op.add_column("posting_batches", sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True), schema="acct")
    if not _has_column(conn, "acct", "posting_batches", "posted_by_user_id"):
        op.add_column("posting_batches", sa.Column("posted_by_user_id", sa.String(length=36), nullable=True), schema="acct")

    if not _has_index(conn, "acct", "ix_acct_batch_tenant_status"):
        op.create_index("ix_acct_batch_tenant_status", "posting_batches", ["tenant_id", "status"], schema="acct")
    if not _has_index(conn, "acct", "ix_acct_journal_tenant_status_date"):
        op.create_index("ix_acct_journal_tenant_status_date", "journals", ["tenant_id", "posting_date"], schema="acct")

    if not _has_constraint(conn, "acct", "posting_batches", "ck_acct_batch_status"):
        op.create_check_constraint(
            "ck_acct_batch_status",
            "posting_batches",
            "status IN ('DRAFT','VALIDATED','POSTED','REVERSED')",
            schema="acct",
        )
    op.execute("UPDATE acct.periods SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL")
    op.execute("UPDATE acct.accounts SET type = UPPER(TRIM(type)) WHERE type IS NOT NULL")
    op.execute("UPDATE acct.accounts SET normal_balance = UPPER(TRIM(normal_balance)) WHERE normal_balance IS NOT NULL")

    period_bad = conn.execute(
        sa.text("SELECT COUNT(*) FROM acct.periods WHERE status NOT IN ('OPEN','CLOSED') OR status IS NULL")
    ).scalar() or 0
    if period_bad == 0 and not _has_constraint(conn, "acct", "periods", "ck_acct_period_status"):
        op.create_check_constraint("ck_acct_period_status", "periods", "status IN ('OPEN','CLOSED')", schema="acct")

    acct_type_bad = conn.execute(
        sa.text("SELECT COUNT(*) FROM acct.accounts WHERE type NOT IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') OR type IS NULL")
    ).scalar() or 0
    if acct_type_bad == 0 and not _has_constraint(conn, "acct", "accounts", "ck_acct_account_type"):
        op.create_check_constraint(
            "ck_acct_account_type",
            "accounts",
            "type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')",
            schema="acct",
        )

    normal_bad = conn.execute(
        sa.text("SELECT COUNT(*) FROM acct.accounts WHERE normal_balance NOT IN ('DEBIT','CREDIT') OR normal_balance IS NULL")
    ).scalar() or 0
    if normal_bad == 0 and not _has_constraint(conn, "acct", "accounts", "ck_acct_account_normal_balance"):
        op.create_check_constraint(
            "ck_acct_account_normal_balance",
            "accounts",
            "normal_balance IN ('DEBIT','CREDIT')",
            schema="acct",
        )
    if not _has_constraint(conn, "acct", "periods", "ck_acct_period_month"):
        op.create_check_constraint("ck_acct_period_month", "periods", "month BETWEEN 1 AND 12", schema="acct")

    for idx_name, table_name, cols in (
        ("ix_customers_tenant_created", "customers", ["tenant_id", "created_at"]),
        ("ix_vehicles_tenant_created", "vehicles", ["tenant_id", "created_at"]),
        ("ix_appts_tenant_status_start", "appointments", ["tenant_id", "status", "scheduled_start"]),
        ("ix_readmodels_documents_tenant_updated", "documents", ["tenant_id", "updated_at"]),
    ):
        schema = "readmodels" if table_name == "documents" else "public"
        if not _has_index(conn, schema, idx_name):
            op.create_index(idx_name, table_name, cols, schema=(None if schema == "public" else schema))


def downgrade() -> None:
    conn = op.get_bind()
    for idx_name, table_name, schema in (
        ("ix_readmodels_documents_tenant_updated", "documents", "readmodels"),
        ("ix_appts_tenant_status_start", "appointments", None),
        ("ix_vehicles_tenant_created", "vehicles", None),
        ("ix_customers_tenant_created", "customers", None),
        ("ix_acct_journal_tenant_status_date", "journals", "acct"),
        ("ix_acct_batch_tenant_status", "posting_batches", "acct"),
        ("ix_acct_jline_tenant_dept_store", "journal_lines", "acct"),
        ("ix_acct_jline_tenant_created", "journal_lines", "acct"),
        ("ix_acct_accounts_tenant_created", "accounts", "acct"),
        ("ix_platform_idempotency_record_tenant_created", "idempotency_records", "platform"),
        ("ux_platform_idempotency_record", "idempotency_records", "platform"),
    ):
        if _has_index(conn, schema or "public", idx_name):
            op.drop_index(idx_name, table_name=table_name, schema=schema)
    if conn.execute(sa.text("select to_regclass('platform.idempotency_records')")).scalar():
        op.drop_table("idempotency_records", schema="platform")
