"""admin module rbac foundation

Revision ID: 2d5f6a7b8c90
Revises: f2a9d4c7b1e0
Create Date: 2026-03-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "2d5f6a7b8c90"
down_revision: Union[str, None] = "f2a9d4c7b1e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.add_column("users", sa.Column("display_name", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "users",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.add_column(
        "users",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.execute("UPDATE users SET is_active = CASE WHEN is_disabled THEN false ELSE true END")

    op.add_column("memberships", sa.Column("id", sa.String(length=36), nullable=True))
    op.add_column("memberships", sa.Column("role_id", sa.String(length=36), nullable=True))
    op.add_column(
        "memberships",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("UPDATE memberships SET id = gen_random_uuid()::text WHERE id IS NULL")
    op.alter_column("memberships", "id", nullable=False)
    op.create_unique_constraint("uq_memberships_id", "memberships", ["id"])

    op.create_table(
        "roles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "name", name="ux_platform_roles_tenant_name"),
    )
    op.create_index("ix_platform_roles_tenant_name", "roles", ["tenant_id", "name"], unique=False)

    op.create_table(
        "permissions",
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.String(length=36), nullable=False),
        sa.Column("permission_key", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["permission_key"], ["permissions.key"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_key"),
        sa.UniqueConstraint("role_id", "permission_key", name="ux_platform_role_permissions"),
    )
    op.create_index("ix_platform_role_permissions_role_id", "role_permissions", ["role_id"], unique=False)

    op.create_foreign_key(
        "fk_memberships_role_id_platform_roles",
        "memberships",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_memberships_tenant_role_id", "memberships", ["tenant_id", "role_id"], unique=False)

    op.execute(
        """
        INSERT INTO permissions(key, description) VALUES
          ('admin.users.read', 'View tenant users'),
          ('admin.users.write', 'Create and update tenant users'),
          ('admin.roles.read', 'View tenant roles and permission mappings'),
          ('admin.roles.write', 'Create and update tenant roles and permissions'),
          ('admin.audit.read', 'View tenant admin audit trail'),
          ('ops.console.read', 'Access operations console'),
          ('tenant.settings.write', 'Manage tenant settings'),
          ('featureflags.write', 'Manage tenant feature flags'),
          ('theme.write', 'Manage tenant branding theme')
        ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
        """
    )

    op.execute(
        """
        INSERT INTO roles(id, tenant_id, name, description, created_at, updated_at)
        SELECT gen_random_uuid()::text, m.tenant_id, 'ADMIN', 'Default admin role', now(), now()
        FROM memberships m
        LEFT JOIN roles r
          ON r.tenant_id = m.tenant_id AND r.name = 'ADMIN'
        WHERE upper(m.role) = 'ADMIN' AND r.id IS NULL
        GROUP BY m.tenant_id
        """
    )

    op.execute(
        """
        UPDATE memberships m
        SET role_id = r.id,
            role = r.name,
            updated_at = now()
        FROM roles r
        WHERE r.tenant_id = m.tenant_id
          AND r.name = 'ADMIN'
          AND upper(m.role) = 'ADMIN'
          AND m.role_id IS NULL
        """
    )

    op.execute(
        """
        INSERT INTO role_permissions(role_id, permission_key)
        SELECT r.id, p.key
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = 'ADMIN'
          AND p.key IN (
            'admin.users.read',
            'admin.users.write',
            'admin.roles.read',
            'admin.roles.write',
            'admin.audit.read',
            'ops.console.read'
          )
        ON CONFLICT (role_id, permission_key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_memberships_tenant_role_id", table_name="memberships")
    op.drop_constraint("fk_memberships_role_id_platform_roles", "memberships", type_="foreignkey")
    op.drop_constraint("uq_memberships_id", "memberships", type_="unique")
    op.drop_column("memberships", "updated_at")
    op.drop_column("memberships", "role_id")
    op.drop_column("memberships", "id")

    op.drop_index("ix_platform_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_index("ix_platform_roles_tenant_name", table_name="roles")
    op.drop_table("roles")

    op.drop_column("users", "updated_at")
    op.drop_column("users", "created_at")
    op.drop_column("users", "is_active")
    op.drop_column("users", "display_name")
