# ==========================================
# KUTM EXTEND (PATCHED FOR WINDOWS PS + PY3.14)
# git + pre-commit + alembic + casbin
# ==========================================

$ErrorActionPreference = "Stop"

$Root    = "C:\kingunderthemountain"
$Backend = Join-Path $Root "backend"

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

# Write UTF-8 without BOM (critical for TOML/INI/YAML/parsers on Windows)
function Write-Utf8NoBom([string]$path, [string]$content) {
  $dir = Split-Path $path -Parent
  Ensure-Dir $dir
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

function Has-Cmd([string]$cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Ensure-LineInFile([string]$file, [string]$line) {
  if (-not (Test-Path $file)) { throw "Missing file: $file" }
  $raw = Get-Content $file -Raw
  if ($raw -notmatch [regex]::Escape($line)) {
    $raw = $raw.TrimEnd() + "`r`n" + $line + "`r`n"
    Set-Content -Path $file -Value $raw -Encoding UTF8
  }
}

if (-not (Test-Path $Root))   { throw "Root not found: $Root. Run init script first." }
if (-not (Test-Path $Backend)) { throw "Backend not found: $Backend. Run init script first." }
if (-not (Has-Cmd "git"))     { throw "git not found. Install Git for Windows." }

Write-Host "=== KUTM EXTEND (PATCHED) START ==="

# ------------------------------------------------------------
# 0) Ensure backend venv exists
# ------------------------------------------------------------
Set-Location $Backend
if (-not (Test-Path (Join-Path $Backend ".venv"))) {
  python -m venv .venv
}
$Py  = Join-Path $Backend ".venv\Scripts\python.exe"
$Pip = Join-Path $Backend ".venv\Scripts\pip.exe"

& $Py -m pip install --upgrade pip

# ------------------------------------------------------------
# 1) Add dependencies: pre-commit + casbin
#    (requirements already fixed for Py3.14 earlier)
# ------------------------------------------------------------
Write-Host "`n=== Ensuring deps (pre-commit + casbin) ==="
$reqPath = Join-Path $Backend "requirements.txt"
if (-not (Test-Path $reqPath)) { throw "Missing: $reqPath" }

# Add if missing (keep versions flexible—pinned in your file if you prefer)
$reqRaw = Get-Content $reqPath -Raw
if ($reqRaw -notmatch "(?m)^pre-commit==") { Add-Content -Path $reqPath -Value "pre-commit==3.8.0" }
if ($reqRaw -notmatch "(?m)^casbin==")     { Add-Content -Path $reqPath -Value "casbin==1.36.0" }

& $Pip install -r $reqPath

# ------------------------------------------------------------
# 2) Core DB models (so Alembic autogenerate produces tables)
# ------------------------------------------------------------
Write-Host "`n=== Writing core models (identity/tenancy/rbac/audit) ==="

Write-Utf8NoBom (Join-Path $Backend "app\modules\identity\models.py") @"
import uuid
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
"@

Write-Utf8NoBom (Join-Path $Backend "app\modules\tenancy\models.py") @"
import uuid
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
"@

Write-Utf8NoBom (Join-Path $Backend "app\modules\rbac\models.py") @"
import uuid
from sqlalchemy import String, DateTime, func, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key: Mapped[str] = mapped_column(String(200), unique=True, index=True)  # e.g. "vehicles.read"
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id","role_id", name="uq_user_role"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id", ondelete="CASCADE"))

class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id","permission_id", name="uq_role_permission"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id", ondelete="CASCADE"))
    permission_id: Mapped[str] = mapped_column(String(36), ForeignKey("permissions.id", ondelete="CASCADE"))
"@

Write-Utf8NoBom (Join-Path $Backend "app\modules\audit\models.py") @"
import uuid
from sqlalchemy import String, DateTime, func, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    method: Mapped[str] = mapped_column(String(16))
    path: Mapped[str] = mapped_column(String(500))
    status_code: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
"@

# Registry import file so Alembic autogenerate sees models
Write-Utf8NoBom (Join-Path $Backend "app\db\model_registry.py") @"
# Import all models here so Alembic 'autogenerate' sees them.
# This file should ONLY contain imports.
from app.modules.identity.models import User  # noqa: F401
from app.modules.tenancy.models import Tenant  # noqa: F401
from app.modules.rbac.models import Role, Permission, UserRole, RolePermission  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
"@

# ------------------------------------------------------------
# 3) Alembic setup (BOM-safe)
# ------------------------------------------------------------
Write-Host "`n=== Setting up Alembic ==="

Ensure-Dir (Join-Path $Backend "alembic\versions")

Write-Utf8NoBom (Join-Path $Backend "alembic.ini") @"
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
level = INFO
handlers = console
qualname =

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
"@

Write-Utf8NoBom (Join-Path $Backend "alembic\env.py") @"
from __future__ import annotations
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
import app.db.model_registry  # noqa: F401  (ensures models are imported)

config = context.config
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url() -> str:
    return settings.database_url

def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
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
"@

# ------------------------------------------------------------
# 4) Casbin wiring (BOM-safe)
# ------------------------------------------------------------
Write-Host "`n=== Adding Casbin wiring ==="

Ensure-Dir (Join-Path $Backend "app\core\authz")

Write-Utf8NoBom (Join-Path $Backend "app\core\authz\casbin_model.conf") @"
[request_definition]
r = sub, obj, act, tenant

[policy_definition]
p = sub, obj, act, tenant

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (g(r.sub, p.sub) || r.sub == p.sub) && r.obj == p.obj && r.act == p.act && (p.tenant == "*" || r.tenant == p.tenant)
"@

Write-Utf8NoBom (Join-Path $Backend "app\core\authz\policy.csv") @"
# Example policies (edit later):
# p, role:admin, vehicles, read, *
# p, role:admin, vehicles, write, *
"@

Write-Utf8NoBom (Join-Path $Backend "app\core\authz\enforcer.py") @"
from __future__ import annotations
import os
import casbin

def get_enforcer() -> casbin.Enforcer:
    base = os.path.dirname(__file__)
    model_path = os.path.join(base, "casbin_model.conf")
    policy_path = os.path.join(base, "policy.csv")
    return casbin.Enforcer(model_path, policy_path)
"@

Write-Utf8NoBom (Join-Path $Backend "app\core\authz\deps.py") @"
from __future__ import annotations
from fastapi import Depends, HTTPException, status
from app.core.authz.enforcer import get_enforcer

def require_permission(obj: str, act: str):
    def _guard(enforcer = Depends(get_enforcer)):
        # TODO: replace placeholders with real current_user + tenant context
        sub = "role:admin"
        tenant = "*"
        if not enforcer.enforce(sub, obj, act, tenant):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return True
    return _guard
"@

# ------------------------------------------------------------
# 5) Pre-commit config (BOM-safe)
# ------------------------------------------------------------
Write-Host "`n=== Adding pre-commit hooks config ==="

Write-Utf8NoBom (Join-Path $Root ".pre-commit-config.yaml") @"
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.2
    hooks:
      - id: ruff
        args: [--fix]
        files: ^backend/
      - id: ruff-format
        files: ^backend/

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        files: ^backend/

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.10
    hooks:
      - id: bandit
        args: ["-q", "-r", "backend/app"]
        pass_filenames: false

  - repo: https://github.com/pypa/pip-audit
    rev: v2.7.3
    hooks:
      - id: pip-audit
        args: ["-r", "backend/requirements.txt"]
        pass_filenames: false
"@

# Install hooks
Write-Host "`n=== Installing pre-commit hooks ==="
Set-Location $Root
$PreCommitExe = Join-Path $Backend ".venv\Scripts\pre-commit.exe"
& $PreCommitExe install

# ------------------------------------------------------------
# 6) Create Alembic revision (autogenerate)
# ------------------------------------------------------------
Write-Host "`n=== Creating Alembic revision (autogenerate) ==="
Set-Location $Backend

# Ensure .env exists
if (-not (Test-Path (Join-Path $Backend ".env"))) {
  Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
}

$AlembicExe = Join-Path $Backend ".venv\Scripts\alembic.exe"
& $AlembicExe revision --autogenerate -m "init core tables"

Write-Host "`nNOTE: Apply migration after Postgres is running:"
Write-Host "  docker compose -f C:\kingunderthemountain\infra\docker-compose.yml up -d"
Write-Host "  cd C:\kingunderthemountain\backend"
Write-Host "  .\.venv\Scripts\alembic.exe upgrade head"

# ------------------------------------------------------------
# 7) Git init + first commit
# ------------------------------------------------------------
Write-Host "`n=== Git init + first commit ==="
Set-Location $Root

if (-not (Test-Path (Join-Path $Root ".git"))) {
  git init | Out-Null
  Write-Host "git init complete."
} else {
  Write-Host "git already initialized."
}

git add -A
git commit -m "Scaffold: docs, alembic, casbin, pre-commit, core models" | Out-Null

Write-Host "`n✅ KUTM EXTEND (PATCHED) COMPLETE."
Write-Host "Next:"
Write-Host "  1) Start Postgres: docker compose -f .\infra\docker-compose.yml up -d"
Write-Host "  2) Apply DB:       cd .\backend ; .\.venv\Scripts\alembic.exe upgrade head"
Write-Host "  3) Run API:        cd .\backend ; .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8010 --reload"
Write-Host "  4) Run hooks:      cd C:\kingunderthemountain ; backend\.venv\Scripts\pre-commit.exe run --all-files"

Write-Host "=== KUTM EXTEND END ==="
