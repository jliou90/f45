"""add customer crm profile table

Revision ID: c3d4e5f6a7b8
Revises: a9c4e5f6d7a8
Create Date: 2026-03-05
"""

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "a9c4e5f6d7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_crm_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("customer_id", sa.String(length=36), nullable=False),
        sa.Column("dms_customer_id", sa.String(length=64), nullable=True),
        sa.Column("spouse_first_name", sa.String(length=100), nullable=True),
        sa.Column("spouse_last_name", sa.String(length=100), nullable=True),
        sa.Column("spouse_phone", sa.String(length=30), nullable=True),
        sa.Column("spouse_email", sa.String(length=255), nullable=True),
        sa.Column("spouse_notes", sa.Text(), nullable=True),
        sa.Column("household_id", sa.String(length=64), nullable=True),
        sa.Column("household_relationship", sa.String(length=100), nullable=True),
        sa.Column("linked_customer_ids", sa.JSON(), nullable=False),
        sa.Column("phones", sa.JSON(), nullable=False),
        sa.Column("emails", sa.JSON(), nullable=False),
        sa.Column("garage", sa.JSON(), nullable=False),
        sa.Column("notes", sa.JSON(), nullable=False),
        sa.Column("communications", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "customer_id", name="uq_customer_crm_tenant_customer"),
    )
    op.create_index("ix_customer_crm_profiles_tenant_id", "customer_crm_profiles", ["tenant_id"], unique=False)
    op.create_index("ix_customer_crm_profiles_customer_id", "customer_crm_profiles", ["customer_id"], unique=False)
    op.create_index("ix_customer_crm_tenant_customer", "customer_crm_profiles", ["tenant_id", "customer_id"], unique=False)
    op.create_index("ix_customer_crm_tenant_updated", "customer_crm_profiles", ["tenant_id", "updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_customer_crm_tenant_updated", table_name="customer_crm_profiles")
    op.drop_index("ix_customer_crm_tenant_customer", table_name="customer_crm_profiles")
    op.drop_index("ix_customer_crm_profiles_customer_id", table_name="customer_crm_profiles")
    op.drop_index("ix_customer_crm_profiles_tenant_id", table_name="customer_crm_profiles")
    op.drop_table("customer_crm_profiles")
