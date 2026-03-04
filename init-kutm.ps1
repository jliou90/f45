# ==========================================
# King Under The Mountain - Init + Install
# Location: C:\kingunderthemountain
# Creates dirs, docs, backend+frontend scaffolds, installs deps
# ==========================================

$ErrorActionPreference = "Stop"

$Root = "C:\kingunderthemountain"
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Write-File([string]$path, [string]$content) {
  $dir = Split-Path $path -Parent
  Ensure-Dir $dir
  Set-Content -Path $path -Value $content -Encoding UTF8
}

function Has-Cmd([string]$cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

Write-Host "=== KUTM INIT START ==="

# --- Basic tool checks
if (-not (Has-Cmd "python")) { throw "Python not found. Install Python 3.11+ and re-run." }
if (-not (Has-Cmd "pip")) { throw "pip not found. Ensure Python/pip is installed and on PATH." }
if (-not (Has-Cmd "node")) { throw "Node.js not found. Install Node 18+ and re-run." }
if (-not (Has-Cmd "npm")) { throw "npm not found. Install Node (npm included) and re-run." }

# --- Create directory map (core + lots of modules)
Ensure-Dir $Root

$dirs = @(
  "docs",
  "infra",
  "scripts",
  "tools",

  "backend\app\core",
  "backend\app\db",
  "backend\app\middleware",
  "backend\app\router",
  "backend\app\modules\identity",
  "backend\app\modules\tenancy",
  "backend\app\modules\rbac",
  "backend\app\modules\audit",
  "backend\app\modules\health",

  # Domain modules (initial placeholders)
  "backend\app\modules\customers",
  "backend\app\modules\vehicles",
  "backend\app\modules\service",
  "backend\app\modules\parts",
  "backend\app\modules\notes",
  "backend\app\modules\settings",
  "backend\app\modules\tax",
  "backend\app\modules\sales",
  "backend\app\modules\finance",
  "backend\app\modules\accounting",
  "backend\app\modules\crm",
  "backend\app\modules\comms",

  "backend\tests",
  "backend\alembic\versions",

  # Frontend folder (vite will populate)
  "frontend"
)

$dirs | ForEach-Object { Ensure-Dir (Join-Path $Root $_) }

# --- .gitignore
Write-File (Join-Path $Root ".gitignore") @"
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.venv/
.env
.env.*
!.env.example
.pytest_cache/
.mypy_cache/
.coverage
htmlcov/

# Node
node_modules/
dist/

# OS / IDE
.DS_Store
Thumbs.db
.vscode/
.idea/
"@

# --- Root README.md (your operating manual)
Write-File (Join-Path $Root "README.md") @"
# King Under The Mountain (KUTM) - DMS

**Goal:** Enterprise-grade, modular DMS for dealership LAN/Windows environments.

## Current Stack
- Backend: FastAPI + PostgreSQL + SQLAlchemy + Alembic
- Frontend: React + TypeScript (Vite)
- Security: bcrypt password hashing, JWT access+refresh, audit middleware stub
- Tooling: pytest, ruff, mypy, bandit, pip-audit

## Quick Start (Dev)
### 1) Infra (Postgres)
From repo root:
\`\`\`powershell
docker compose -f .\infra\docker-compose.yml up -d
\`\`\`

### 2) Backend
\`\`\`powershell
cd .\backend
copy .\.env.example .\.env -ErrorAction SilentlyContinue
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8010 --reload
\`\`\`

### 3) Frontend
\`\`\`powershell
cd .\frontend
npm run dev
\`\`\`

## Docs to ALWAYS Maintain
- docs/HANDOFF.md (resume button)
- docs/DIRECTORY_MAP.md (where files go)
- docs/API_INDEX.md (endpoint -> file map)

## Notes
- **Never** hardcode secrets in code. Use backend/.env
- Passwords are stored hashed (bcrypt) only.
- Keep changes modular: each feature lives in its module folder.
"@

# --- Docs: HANDOFF + DIRECTORY_MAP + API_INDEX
Write-File (Join-Path $Root "docs\HANDOFF.md") @"
# KUTM HANDOFF

## What we're building
A modular, LAN-first DMS that runs great on Windows dealership PCs.

## Foundation features (v0.1)
- Auth login + refresh (JWT)
- Tenant create/select
- Roles/permissions skeleton
- Audit logging middleware
- Health/version endpoint
- Minimal UI shell + sign-in screen
- No plaintext passwords (bcrypt)

## Today's changes
- Scaffolded monorepo: backend + frontend + infra + docs
- Installed dependencies

## Next
1) Add Alembic config + initial migrations
2) Implement tenant context (header + DB lookup)
3) Implement RBAC enforcement (Casbin-ready hooks)
4) Persist audit logs to DB (PII-safe)
"@

Write-File (Join-Path $Root "docs\DIRECTORY_MAP.md") @"
# DIRECTORY MAP (Single Source of Truth)

## Rule
**Every feature is a module** in: backend/app/modules/<module_name>/
Each module contains:
- api.py (routes)
- models.py (SQLAlchemy tables)
- schemas.py (Pydantic)
- service.py (business logic)
- deps.py (dependencies/guards)
- policy.py (authorization rules)
- tests/ (module tests)

## Core
- backend/app/core/* : settings, security primitives
- backend/app/db/*   : engine/session/base
- backend/app/middleware/* : request_id, audit, etc
- backend/app/main.py : app factory + router registration

## Frontend
- frontend/src/pages : screens
- frontend/src/components : reusable UI
- frontend/src/api : API client wrappers (keep consistent)

## Naming
- snake_case for python files and folders
- Keep route prefixes short: /auth, /tenants, /vehicles, /appointments
"@

Write-File (Join-Path $Root "docs\API_INDEX.md") @"
# API INDEX (Endpoint -> File)

- /health, /version -> backend/app/modules/health/api.py
- /auth/*           -> backend/app/modules/identity/api.py
- /tenants/*        -> backend/app/modules/tenancy/api.py
- /rbac/*           -> backend/app/modules/rbac/api.py
- /audit/*          -> backend/app/modules/audit/api.py

(Expand this file whenever you add a new router.)
"@

# --- Infra: docker-compose for Postgres (password is in env here; not in code)
Write-File (Join-Path $Root "infra\docker-compose.yml") @"
services:
  postgres:
    image: postgres:16
    container_name: kutm_postgres
    environment:
      POSTGRES_DB: kutm
      POSTGRES_USER: kutm
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - kutm_pgdata:/var/lib/postgresql/data
volumes:
  kutm_pgdata:
"@

# --- Backend: requirements + env example + minimal app skeleton
Write-File (Join-Path $Backend "requirements.txt") @"
fastapi==0.115.6
uvicorn[standard]==0.32.1

SQLAlchemy==2.0.36
psycopg[binary]==3.2.3
alembic==1.14.0

pydantic==2.10.3
pydantic-settings==2.6.1

python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

pytest==8.3.4
httpx==0.28.1

ruff==0.8.2
mypy==1.13.0
bandit==1.7.10
pip-audit==2.7.3
"@

Write-File (Join-Path $Backend ".env.example") @"
APP_NAME=KingUnderTheMountain
ENV=dev

JWT_SECRET=dev_change_me
JWT_ALG=HS256
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=30

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=kutm
DB_USER=kutm
DB_PASSWORD=password
"@

Write-File (Join-Path $Backend "pyproject.toml") @"
[tool.ruff]
line-length = 100
target-version = "py311"
select = ["E","F","I","UP","B","SIM"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
no_implicit_optional = true
"@

Write-File (Join-Path $Backend "app\__init__.py") ""
Write-File (Join-Path $Backend "app\core\config.py") @"
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "KingUnderTheMountain"
    env: str = "dev"

    jwt_secret: str = "dev_change_me"
    jwt_alg: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_name: str = "kutm"
    db_user: str = "kutm"
    db_password: str = "password"

    @property
    def database_url(self) -> str:
        return f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

settings = Settings()
"@

Write-File (Join-Path $Backend "app\core\security.py") @"
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(subject: str, tenant_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload: Dict[str, Any] = {"sub": subject, "iat": int(now.timestamp()), "exp": exp}
    if tenant_id:
        payload["tenant_id"] = tenant_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)

def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=settings.refresh_token_days)
    payload: Dict[str, Any] = {"sub": subject, "type": "refresh", "iat": int(now.timestamp()), "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)
"@

Write-File (Join-Path $Backend "app\db\base.py") @"
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
"@

Write-File (Join-Path $Backend "app\db\session.py") @"
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
"@

Write-File (Join-Path $Backend "app\middleware\request_id.py") @"
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        response: Response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
"@

Write-File (Join-Path $Backend "app\middleware\audit.py") @"
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # TODO: write to DB audit_log (PII-safe)
        response = await call_next(request)
        return response
"@

# --- Module routers (stubs)
Write-File (Join-Path $Backend "app\modules\health\api.py") @"
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/version")
def version():
    return {"app": settings.app_name, "env": settings.env, "version": "0.1.0"}
"@

Write-File (Join-Path $Backend "app\modules\identity\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login():
    return {"todo": "login (verify bcrypt hash + issue jwt access/refresh)"}

@router.post("/refresh")
def refresh():
    return {"todo": "refresh (rotate refresh tokens later)"}
"@

Write-File (Join-Path $Backend "app\modules\tenancy\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("/")
def list_tenants():
    return {"todo": "list tenants"}

@router.post("/")
def create_tenant():
    return {"todo": "create tenant"}

@router.post("/select")
def select_tenant():
    return {"todo": "select tenant context"}
"@

Write-File (Join-Path $Backend "app\modules\rbac\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/rbac", tags=["rbac"])

@router.get("/roles")
def roles():
    return {"todo": "role list"}

@router.get("/permissions")
def permissions():
    return {"todo": "permission list"}
"@

Write-File (Join-Path $Backend "app\modules\audit\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/")
def audit_search():
    return {"todo": "audit search endpoint (admin-only)"}
"@

# Router registry (single source of router truth)
Write-File (Join-Path $Backend "app\router\api.py") @"
from fastapi import APIRouter

from app.modules.health.api import router as health_router
from app.modules.identity.api import router as auth_router
from app.modules.tenancy.api import router as tenancy_router
from app.modules.rbac.api import router as rbac_router
from app.modules.audit.api import router as audit_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(tenancy_router)
api_router.include_router(rbac_router)
api_router.include_router(audit_router)
"@

Write-File (Join-Path $Backend "app\main.py") @"
from fastapi import FastAPI
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.audit import AuditMiddleware
from app.router.api import api_router

def create_app() -> FastAPI:
    app = FastAPI(title="King Under The Mountain - API")
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(AuditMiddleware)
    app.include_router(api_router)
    return app

app = create_app()
"@

Write-File (Join-Path $Backend "tests\test_health.py") @"
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'
"@

# Tools docs
Write-File (Join-Path $Root "tools\SECURITY.md") @"
# SECURITY BASELINE
- No plaintext passwords (bcrypt)
- JWT secrets stored in .env (not in code)
- Audit logs are PII-safe (do not log full request bodies)
- pip-audit + bandit in CI
"@

# --- Install backend deps
Write-Host "`n=== Installing BACKEND dependencies ==="
Set-Location $Backend

if (-not (Test-Path (Join-Path $Backend ".env"))) {
  Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
  Write-Host "Created backend\.env from .env.example"
}

if (-not (Test-Path (Join-Path $Backend ".venv"))) {
  python -m venv .venv
}

& (Join-Path $Backend ".venv\Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $Backend ".venv\Scripts\pip.exe") install -r requirements.txt

# --- Frontend scaffold + install
Write-Host "`n=== Creating FRONTEND (React+TS via Vite) ==="
Set-Location $Root

# If frontend already has package.json, don't overwrite; otherwise scaffold
if (-not (Test-Path (Join-Path $Frontend "package.json"))) {
  Set-Location $Root
  # Vite will create a folder; we want it to land in ./frontend
  # We'll create a temp folder then move contents in if needed.
  $tmp = Join-Path $Root "_tmp_vite_frontend"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

  npm create vite@latest _tmp_vite_frontend -- --template react-ts
  Set-Location $tmp
  npm install

  # Move into frontend
  Ensure-Dir $Frontend
  Get-ChildItem -Force | ForEach-Object {
    Move-Item -Force $_.FullName (Join-Path $Frontend $_.Name)
  }

  Set-Location $Root
  Remove-Item -Recurse -Force $tmp
  Write-Host "Frontend scaffolded into $Frontend"
} else {
  Write-Host "Frontend already exists; skipping Vite scaffold."
  Set-Location $Frontend
  npm install
}

# --- Done
Set-Location $Root
Write-Host "`n✅ KUTM scaffold + installs complete at $Root"
Write-Host "`nNext:"
Write-Host "  1) Start Postgres:   docker compose -f .\infra\docker-compose.yml up -d"
Write-Host "  2) Run Backend:      cd .\backend ; .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8010 --reload"
Write-Host "  3) Run Frontend:     cd .\frontend ; npm run dev"
Write-Host "`n=== KUTM INIT END ==="
