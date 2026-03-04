"""patchA.4 audit trail kernel (audit_events table)

Revision ID: c1d7e2a4b9f0
Revises: 39a9bb3e30c6
Create Date: 2026-02-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c1d7e2a4b9f0"
down_revision: Union[str, None] = "39a9bb3e30c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=200), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("metadata", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_tenant_ts", "audit_events", ["tenant_id", "ts"], unique=False)
    op.create_index("ix_audit_events_tenant_entity", "audit_events", ["tenant_id", "entity_type", "entity_id"], unique=False)
    op.create_index("ix_audit_events_tenant_actor", "audit_events", ["tenant_id", "actor_id", "ts"], unique=False)
    op.create_index("ix_audit_events_tenant_action", "audit_events", ["tenant_id", "action", "ts"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_tenant_action", table_name="audit_events")
    op.drop_index("ix_audit_events_tenant_actor", table_name="audit_events")
    op.drop_index("ix_audit_events_tenant_entity", table_name="audit_events")
    op.drop_index("ix_audit_events_tenant_ts", table_name="audit_events")
    op.drop_table("audit_events")
