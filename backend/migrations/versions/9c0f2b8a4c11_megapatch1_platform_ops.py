"""megapatch1 - platform ops tables (audit, integrations, idempotency)

Revision ID: 9c0f2b8a4c11
Revises: 9b1c1f2a7d10
Create Date: 2026-01-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9c0f2b8a4c11"
down_revision: Union[str, None] = "9b1c1f2a7d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS platform")

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=200), nullable=True),
        sa.Column("entity_type", sa.String(length=100), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index(
        "ix_platform_audit_tenant_time",
        "audit_logs",
        ["tenant_id", "created_at"],
        unique=False,
        schema="platform",
    )
    op.create_index(
        "ix_platform_audit_tenant_actor_time",
        "audit_logs",
        ["tenant_id", "actor_user_id", "created_at"],
        unique=False,
        schema="platform",
    )
    op.create_index(
        "ix_platform_audit_tenant_action_time",
        "audit_logs",
        ["tenant_id", "action", "created_at"],
        unique=False,
        schema="platform",
    )

    # --- webhook_subscriptions ---
    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("secret", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "event_types",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index(
        "ix_platform_webhooks_tenant",
        "webhook_subscriptions",
        ["tenant_id"],
        unique=False,
        schema="platform",
    )

    # --- outbox_messages ---
    op.create_table(
        "outbox_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("topic", sa.String(length=200), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_error", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index(
        "ix_platform_outbox_pending",
        "outbox_messages",
        ["tenant_id", "status", "next_attempt_at"],
        unique=False,
        schema="platform",
    )

    # --- idempotency_keys ---
    op.create_table(
        "idempotency_keys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index(
        "ux_platform_idempotency",
        "idempotency_keys",
        ["tenant_id", "key"],
        unique=True,
        schema="platform",
    )


def downgrade() -> None:
    op.drop_index("ux_platform_idempotency", table_name="idempotency_keys", schema="platform")
    op.drop_table("idempotency_keys", schema="platform")

    op.drop_index("ix_platform_outbox_pending", table_name="outbox_messages", schema="platform")
    op.drop_table("outbox_messages", schema="platform")

    op.drop_index("ix_platform_webhooks_tenant", table_name="webhook_subscriptions", schema="platform")
    op.drop_table("webhook_subscriptions", schema="platform")

    op.drop_index("ix_platform_audit_tenant_action_time", table_name="audit_logs", schema="platform")
    op.drop_index("ix_platform_audit_tenant_actor_time", table_name="audit_logs", schema="platform")
    op.drop_index("ix_platform_audit_tenant_time", table_name="audit_logs", schema="platform")
    op.drop_table("audit_logs", schema="platform")
