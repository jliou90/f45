"""add portal user prefs table

Revision ID: b2c3d4e5f6a7
Revises: e5f6a7b8c9d0
Create Date: 2026-03-05 17:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portal_user_prefs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("saved_views_json", sa.JSON(), nullable=False),
        sa.Column("default_view_id", sa.String(length=64), nullable=True),
        sa.Column("team_queue_mode", sa.String(length=32), nullable=False),
        sa.Column("role_queue_overrides", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "user_id", name="uq_portal_user_prefs_tenant_user"),
    )
    op.create_index("ix_portal_user_prefs_tenant_updated", "portal_user_prefs", ["tenant_id", "updated_at"], unique=False)
    op.create_index(op.f("ix_portal_user_prefs_tenant_id"), "portal_user_prefs", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_portal_user_prefs_user_id"), "portal_user_prefs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_portal_user_prefs_user_id"), table_name="portal_user_prefs")
    op.drop_index(op.f("ix_portal_user_prefs_tenant_id"), table_name="portal_user_prefs")
    op.drop_index("ix_portal_user_prefs_tenant_updated", table_name="portal_user_prefs")
    op.drop_table("portal_user_prefs")
