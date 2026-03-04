"""add event store + documents read model

Revision ID: b8c2d1f0a9e1
Revises: a1bf5ac0e92e
Create Date: 2026-01-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as psql

# revision identifiers, used by Alembic.
revision: str = "b8c2d1f0a9e1"
down_revision: Union[str, None] = "a1bf5ac0e92e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS events;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS readmodels;"))

    op.create_table(
        "streams",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("stream_type", sa.String(length=100), nullable=False),
        sa.Column("stream_id", sa.String(length=36), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        schema="events",
    )
    op.create_index("ux_events_streams_tenant_type_id", "streams", ["tenant_id", "stream_type", "stream_id"], unique=True, schema="events")

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("stream_type", sa.String(length=100), nullable=False),
        sa.Column("stream_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=200), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("correlation_id", sa.String(length=36), nullable=True),
        sa.Column("causation_id", sa.String(length=36), nullable=True),
        sa.Column("payload", psql.JSONB(), nullable=False),
        sa.Column("metadata", psql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        schema="events",
    )
    op.create_index(
        "ux_events_events_stream_version",
        "events",
        ["tenant_id", "stream_type", "stream_id", "version"],
        unique=True,
        schema="events",
    )
    op.create_index("ix_events_events_tenant_type_time", "events", ["tenant_id", "event_type", "occurred_at"], schema="events")
    op.create_index("ix_events_events_tenant_stream_time", "events", ["tenant_id", "stream_type", "occurred_at"], schema="events")
    op.create_index("ix_events_events_payload_gin", "events", ["payload"], postgresql_using="gin", schema="events")

    op.create_table(
        "documents",
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("doc_type", sa.String(length=100), nullable=False),
        sa.Column("doc_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("document", psql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("tenant_id", "doc_type", "doc_id", name="pk_documents"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        schema="readmodels",
    )
    op.create_index("ix_readmodels_documents_type", "documents", ["tenant_id", "doc_type"], schema="readmodels")
    op.create_index("ix_readmodels_documents_gin", "documents", ["document"], postgresql_using="gin", schema="readmodels")


def downgrade() -> None:
    op.drop_table("documents", schema="readmodels")
    op.drop_table("events", schema="events")
    op.drop_table("streams", schema="events")
    op.execute(sa.text("DROP SCHEMA IF EXISTS readmodels CASCADE;"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS events CASCADE;"))