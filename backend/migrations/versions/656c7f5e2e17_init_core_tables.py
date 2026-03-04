"""init core tables

Revision ID: 656c7f5e2e17
Revises:
Create Date: 2025-12-30 14:29:14.998206
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "656c7f5e2e17"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tenants -------------------------------------------------
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        op.f("ix_tenants_name"),
        "tenants",
        ["name"],
        unique=True,
    )

    # --- users ---------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(
        op.f("ix_users_email"),
        "users",
        ["email"],
        unique=True,
    )


def downgrade() -> None:
    # --- users ---------------------------------------------------
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    # --- tenants -------------------------------------------------
    op.drop_index(op.f("ix_tenants_name"), table_name="tenants")
    op.drop_table("tenants")
