"""maturity workflows: mfa, comms, inventory procurement, scheduler enrichment

Revision ID: a9c4e5f6d7a8
Revises: f2a9d4c7b1e0
Create Date: 2026-03-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as psql

# revision identifiers, used by Alembic.
revision: str = "a9c4e5f6d7a8"
down_revision: Union[str, None] = "62b054437a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    permission_rows = (
        ("dms.scheduler.read", "View technician availability and scheduler context"),
        ("comms.customer.read", "View outbound customer communications"),
        ("comms.customer.write", "Send and log outbound customer communications"),
        ("comms.funding.write", "Send lender stip communications and update funding status"),
        ("inventory.supplies.read", "View consumable inventory supply levels"),
        ("inventory.supplies.write", "Create and update consumable inventory supplies"),
        ("inventory.procurement.read", "View inventory procurement order batches"),
        ("inventory.procurement.write", "Create and update inventory procurement order batches"),
    )
    for key, description in permission_rows:
        op.execute(
            sa.text(
                """
                INSERT INTO permissions (key, description)
                VALUES (:key, :description)
                ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
                """
            ).bindparams(key=key, description=description)
        )

    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("mfa_secret", sa.String(length=128), nullable=True))

    op.add_column("appointments", sa.Column("technician_user_id", sa.String(length=36), nullable=True))
    op.add_column("appointments", sa.Column("service_advisor_user_id", sa.String(length=36), nullable=True))
    op.create_index("ix_appointments_technician_user_id", "appointments", ["technician_user_id"], unique=False)
    op.create_index("ix_appointments_service_advisor_user_id", "appointments", ["service_advisor_user_id"], unique=False)
    op.create_foreign_key(
        "fk_appointments_technician_user_id_users",
        "appointments",
        "users",
        ["technician_user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_appointments_service_advisor_user_id_users",
        "appointments",
        "users",
        ["service_advisor_user_id"],
        ["id"],
    )

    op.create_table(
        "inventory_supply_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("sku", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("on_hand_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_point", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default=sa.text("'each'")),
        sa.Column("vendor", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "sku", name="ux_inventory_supply_tenant_sku"),
    )
    op.create_index("ix_inventory_supply_tenant_name", "inventory_supply_items", ["tenant_id", "name"], unique=False)

    op.create_table(
        "inventory_order_batches",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_order_batch_tenant_status", "inventory_order_batches", ["tenant_id", "status"], unique=False)
    op.create_index("ix_inventory_order_batch_tenant_created", "inventory_order_batches", ["tenant_id", "created_at"], unique=False)

    op.create_table(
        "inventory_order_batch_lines",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("batch_id", sa.String(length=36), nullable=False),
        sa.Column("supply_item_id", sa.String(length=36), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["batch_id"], ["inventory_order_batches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supply_item_id"], ["inventory_supply_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "batch_id", "supply_item_id", name="ux_inventory_order_line_supply"),
    )
    op.create_index("ix_inventory_order_line_batch", "inventory_order_batch_lines", ["tenant_id", "batch_id"], unique=False)

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS platform;"))
    op.create_table(
        "outbound_communications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("customer_id", sa.String(length=36), nullable=True),
        sa.Column("deal_id", sa.String(length=36), nullable=True),
        sa.Column("channel", sa.String(length=20), nullable=False, server_default=sa.text("'email'")),
        sa.Column("to_address", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error", sa.String(length=2000), nullable=True),
        sa.Column("attachment_id", sa.String(length=36), nullable=True),
        sa.Column("metadata_json", psql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["attachment_id"], ["readmodels.document_attachments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index(
        "ix_platform_outbound_comms_tenant_entity",
        "outbound_communications",
        ["tenant_id", "entity_type", "entity_id"],
        unique=False,
        schema="platform",
    )
    op.create_index(
        "ix_platform_outbound_comms_tenant_customer",
        "outbound_communications",
        ["tenant_id", "customer_id"],
        unique=False,
        schema="platform",
    )
    op.create_index(
        "ix_platform_outbound_comms_tenant_created",
        "outbound_communications",
        ["tenant_id", "created_at"],
        unique=False,
        schema="platform",
    )


def downgrade() -> None:
    op.drop_index("ix_platform_outbound_comms_tenant_created", table_name="outbound_communications", schema="platform")
    op.drop_index("ix_platform_outbound_comms_tenant_customer", table_name="outbound_communications", schema="platform")
    op.drop_index("ix_platform_outbound_comms_tenant_entity", table_name="outbound_communications", schema="platform")
    op.drop_table("outbound_communications", schema="platform")

    op.drop_index("ix_inventory_order_line_batch", table_name="inventory_order_batch_lines")
    op.drop_table("inventory_order_batch_lines")
    op.drop_index("ix_inventory_order_batch_tenant_created", table_name="inventory_order_batches")
    op.drop_index("ix_inventory_order_batch_tenant_status", table_name="inventory_order_batches")
    op.drop_table("inventory_order_batches")
    op.drop_index("ix_inventory_supply_tenant_name", table_name="inventory_supply_items")
    op.drop_table("inventory_supply_items")

    op.drop_constraint("fk_appointments_service_advisor_user_id_users", "appointments", type_="foreignkey")
    op.drop_constraint("fk_appointments_technician_user_id_users", "appointments", type_="foreignkey")
    op.drop_index("ix_appointments_service_advisor_user_id", table_name="appointments")
    op.drop_index("ix_appointments_technician_user_id", table_name="appointments")
    op.drop_column("appointments", "service_advisor_user_id")
    op.drop_column("appointments", "technician_user_id")

    op.drop_column("users", "mfa_secret")
    op.drop_column("users", "mfa_enabled")

    op.execute(
        sa.text(
            """
            DELETE FROM permissions
            WHERE key IN (
              'dms.scheduler.read',
              'comms.customer.read',
              'comms.customer.write',
              'comms.funding.write',
              'inventory.supplies.read',
              'inventory.supplies.write',
              'inventory.procurement.read',
              'inventory.procurement.write'
            )
            """
        )
    )
