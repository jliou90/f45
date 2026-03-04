"""merge concurrency + prior head

Revision ID: a4f529115403
Revises: 9c0f2b8a4c11
Create Date: 2026-02-09 12:41:16.659874

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4f529115403'
down_revision: Union[str, None] = ("9c0f2b8a4c11",)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
