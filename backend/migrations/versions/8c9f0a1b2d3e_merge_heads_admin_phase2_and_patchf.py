"""merge admin phase2 + patchf heads

Revision ID: 8c9f0a1b2d3e
Revises: 6b2c3d4e5f60, 7a6d5b4c3e2f
Create Date: 2026-03-02
"""

from typing import Sequence
from typing import Union


revision: str = "8c9f0a1b2d3e"
down_revision: Union[str, Sequence[str], None] = ("6b2c3d4e5f60", "7a6d5b4c3e2f")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
