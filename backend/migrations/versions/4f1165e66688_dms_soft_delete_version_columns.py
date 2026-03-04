"""dms soft delete + version columns

Revision ID: 4f1165e66688
Revises: a4f529115403
Create Date: 2026-02-11 18:42:52.479798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4f1165e66688'
down_revision: Union[str, None] = 'a4f529115403'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

from alembic import op
import sqlalchemy as sa

from alembic import op
import sqlalchemy as sa

def _has_column(conn, table: str, column: str) -> bool:
    return conn.execute(
        sa.text(
            """
            select 1
            from information_schema.columns
            where table_schema = current_schema()
              and table_name = :t
              and column_name = :c
            limit 1
            """
        ),
        {"t": table, "c": column},
    ).scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    def add_if_missing(table: str, col: sa.Column) -> None:
        if not _has_column(conn, table, col.name):
            op.add_column(table, col)

    # customers
    add_if_missing("customers", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    add_if_missing("customers", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    add_if_missing("customers", sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")))

    # vehicles
    add_if_missing("vehicles", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    add_if_missing("vehicles", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    add_if_missing("vehicles", sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")))

    # appointments
    add_if_missing("appointments", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    add_if_missing("appointments", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    add_if_missing("appointments", sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")))

    # If the column exists (added previously), these ALTERs are still safe.
    # But on Postgres, altering server_default to None is fine even if it was already None.
    if _has_column(conn, "customers", "is_deleted"):
        op.alter_column("customers", "is_deleted", server_default=None)
    if _has_column(conn, "customers", "version"):
        op.alter_column("customers", "version", server_default=None)

    if _has_column(conn, "vehicles", "is_deleted"):
        op.alter_column("vehicles", "is_deleted", server_default=None)
    if _has_column(conn, "vehicles", "version"):
        op.alter_column("vehicles", "version", server_default=None)

    if _has_column(conn, "appointments", "is_deleted"):
        op.alter_column("appointments", "is_deleted", server_default=None)
    if _has_column(conn, "appointments", "version"):
        op.alter_column("appointments", "version", server_default=None)
def downgrade() -> None:
    conn = op.get_bind()

    def drop_if_exists(table: str, colname: str) -> None:
        if _has_column(conn, table, colname):
            op.drop_column(table, colname)

    drop_if_exists("appointments", "version")
    drop_if_exists("appointments", "deleted_at")
    drop_if_exists("appointments", "is_deleted")

    drop_if_exists("vehicles", "version")
    drop_if_exists("vehicles", "deleted_at")
    drop_if_exists("vehicles", "is_deleted")

    drop_if_exists("customers", "version")
    drop_if_exists("customers", "deleted_at")
    drop_if_exists("customers", "is_deleted")
