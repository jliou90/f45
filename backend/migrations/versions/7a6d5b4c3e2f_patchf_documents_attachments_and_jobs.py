"""patch f: document attachments + jobs

Revision ID: 7a6d5b4c3e2f
Revises: f2a9d4c7b1e0
Create Date: 2026-02-23
"""

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as psql

# revision identifiers, used by Alembic.
revision: str = "7a6d5b4c3e2f"
down_revision: Union[str, None] = "f2a9d4c7b1e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_attachments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=200), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="readmodels",
    )
    op.create_index(
        "ix_readmodels_doc_attachments_tenant_created",
        "document_attachments",
        ["tenant_id", "created_at"],
        unique=False,
        schema="readmodels",
    )

    op.create_table(
        "document_attachment_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("attachment_id", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["attachment_id"], ["readmodels.document_attachments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="readmodels",
    )
    op.create_index(
        "ix_readmodels_doc_attachment_links_tenant_entity",
        "document_attachment_links",
        ["tenant_id", "entity_type", "entity_id"],
        unique=False,
        schema="readmodels",
    )
    op.create_index(
        "ux_readmodels_doc_attachment_link",
        "document_attachment_links",
        ["tenant_id", "attachment_id", "entity_type", "entity_id"],
        unique=True,
        schema="readmodels",
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("job_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload", psql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("result", psql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", psql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="platform",
    )
    op.create_index("ix_platform_jobs_tenant_created", "jobs", ["tenant_id", "created_at"], unique=False, schema="platform")
    op.create_index("ix_platform_jobs_tenant_status", "jobs", ["tenant_id", "status"], unique=False, schema="platform")


def downgrade() -> None:
    op.drop_index("ix_platform_jobs_tenant_status", table_name="jobs", schema="platform")
    op.drop_index("ix_platform_jobs_tenant_created", table_name="jobs", schema="platform")
    op.drop_table("jobs", schema="platform")

    op.drop_index("ux_readmodels_doc_attachment_link", table_name="document_attachment_links", schema="readmodels")
    op.drop_index("ix_readmodels_doc_attachment_links_tenant_entity", table_name="document_attachment_links", schema="readmodels")
    op.drop_table("document_attachment_links", schema="readmodels")

    op.drop_index("ix_readmodels_doc_attachments_tenant_created", table_name="document_attachments", schema="readmodels")
    op.drop_table("document_attachments", schema="readmodels")
