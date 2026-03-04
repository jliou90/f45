# ============================
# KUTM Phase 2 - DB + Alembic
# - Ensures Postgres is running
# - Creates Alembic config + env wiring
# - Autogenerates initial migration
# - Applies migration
# ============================

$Root = "C:\kingunderthemountain"
$Backend = Join-Path $Root "backend"
$Infra = Join-Path $Root "infra"

Set-Location $Backend

# Ensure .env exists
if (-not (Test-Path .\.env)) {
  Copy-Item .\.env.example .\.env
  Write-Host "Created backend\.env from .env.example"
}

# Start Postgres (docker compose)
Write-Host "Starting Postgres via docker compose..."
docker compose -f "$Infra\docker-compose.yml" up -d | Out-Null

# Make sure venv exists
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "Missing .venv. Create it with: py -3.12 -m venv .venv"
  exit 1
}

# Ensure alembic folders exist
New-Item -ItemType Directory -Force -Path ".\alembic\versions" | Out-Null

# Write alembic.ini (rooted in backend/)
$alembicIniPath = Join-Path $Backend "alembic.ini"
@"
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
"@ | Set-Content -Encoding UTF8 $alembicIniPath

# Create db/metadata.py to ensure Base + model imports are centralized
$metadataPy = Join-Path $Backend "app\db\metadata.py"
@"
from app.db.base import Base

# Import models so Alembic sees them (DO NOT remove)
from app.modules.identity.models import User  # noqa: F401
from app.modules.tenancy.models import Tenant  # noqa: F401

# Phase 2+:
# from app.modules.audit.models import AuditLog  # noqa: F401
"@ | Set-Content -Encoding UTF8 $metadataPy

# Create alembic/env.py wired to settings.database_url and Base metadata
$envPy = Join-Path $Backend "alembic\env.py"
@"
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.metadata import Base

# Alembic Config object
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url() -> str:
    return settings.database_url

def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
"@ | Set-Content -Encoding UTF8 $envPy

# Create alembic/script.py.mako if missing (optional; alembic works without customizing)
$scriptMako = Join-Path $Backend "alembic\script.py.mako"
if (-not (Test-Path $scriptMako)) {
@"
"""Migration script template."""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}

def upgrade():
    ${upgrades if upgrades else "pass"}

def downgrade():
    ${downgrades if downgrades else "pass"}
"@ | Set-Content -Encoding UTF8 $scriptMako
}

# Ensure alembic/__init__.py exists
$alembicInit = Join-Path $Backend "alembic\__init__.py"
if (-not (Test-Path $alembicInit)) { "" | Set-Content -Encoding UTF8 $alembicInit }

# Autogenerate initial migration (if none exist)
$existing = Get-ChildItem ".\alembic\versions" -Filter "*.py" -ErrorAction SilentlyContinue
if ($null -ne $existing -and $existing.Count -gt 0) {
  Write-Host "Alembic versions already exist. Skipping autogenerate."
} else {
  Write-Host "Generating initial migration..."
  $env:PYTHONPATH = $Backend
  .\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "init core tables"
}

# Apply migrations
Write-Host "Upgrading DB to head..."
$env:PYTHONPATH = $Backend
.\.venv\Scripts\python.exe -m alembic upgrade head

Write-Host "✅ Phase 2 complete."
Write-Host "Next check: .\alembic\versions\ should contain init migration"
