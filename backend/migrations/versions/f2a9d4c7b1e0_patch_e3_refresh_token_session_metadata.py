"""patch E3 refresh token session metadata

Revision ID: f2a9d4c7b1e0
Revises: e7f9c2a1d4b6
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f2a9d4c7b1e0"
down_revision: Union[str, None] = "e7f9c2a1d4b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("refresh_tokens", sa.Column("user_agent_hash", sa.String(length=64), nullable=True))
    op.add_column("refresh_tokens", sa.Column("ip_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("refresh_tokens", "ip_hash")
    op.drop_column("refresh_tokens", "user_agent_hash")
    op.drop_column("refresh_tokens", "last_seen_at")
