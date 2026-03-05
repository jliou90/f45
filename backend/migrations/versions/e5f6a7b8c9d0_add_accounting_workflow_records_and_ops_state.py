"""add accounting workflow records and ops state

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-05
"""

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("period_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("workflow_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("reference_number", sa.String(length=128), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("employee_id", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("counterparty", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("notes", sa.String(length=2000), nullable=False, server_default=""),
        sa.Column("checklist", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("line_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("tax_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("commission_rate_bps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="acct",
    )
    op.create_index("ix_acct_wf_tenant_updated", "workflow_records", ["tenant_id", "updated_at"], unique=False, schema="acct")
    op.create_index("ix_acct_wf_tenant_type_status", "workflow_records", ["tenant_id", "workflow_type", "status"], unique=False, schema="acct")

    op.create_table(
        "ops_state",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("state_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", name="uq_acct_ops_state_tenant"),
        schema="acct",
    )
    op.create_index("ix_acct_ops_state_tenant_id", "ops_state", ["tenant_id"], unique=False, schema="acct")

    op.alter_column("workflow_records", "period_id", server_default=None, schema="acct")
    op.alter_column("workflow_records", "employee_id", server_default=None, schema="acct")
    op.alter_column("workflow_records", "counterparty", server_default=None, schema="acct")
    op.alter_column("workflow_records", "notes", server_default=None, schema="acct")
    op.alter_column("workflow_records", "checklist", server_default=None, schema="acct")
    op.alter_column("workflow_records", "line_items", server_default=None, schema="acct")
    op.alter_column("workflow_records", "tax_amount", server_default=None, schema="acct")
    op.alter_column("workflow_records", "commission_rate_bps", server_default=None, schema="acct")
    op.alter_column("ops_state", "state_json", server_default=None, schema="acct")


def downgrade() -> None:
    op.drop_index("ix_acct_ops_state_tenant_id", table_name="ops_state", schema="acct")
    op.drop_table("ops_state", schema="acct")
    op.drop_index("ix_acct_wf_tenant_type_status", table_name="workflow_records", schema="acct")
    op.drop_index("ix_acct_wf_tenant_updated", table_name="workflow_records", schema="acct")
    op.drop_table("workflow_records", schema="acct")

