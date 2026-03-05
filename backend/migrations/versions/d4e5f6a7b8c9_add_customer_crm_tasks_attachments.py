"""add tasks and attachments to customer crm profile

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-05
"""

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customer_crm_profiles", sa.Column("tasks", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.add_column("customer_crm_profiles", sa.Column("attachments", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.alter_column("customer_crm_profiles", "tasks", server_default=None)
    op.alter_column("customer_crm_profiles", "attachments", server_default=None)


def downgrade() -> None:
    op.drop_column("customer_crm_profiles", "attachments")
    op.drop_column("customer_crm_profiles", "tasks")
