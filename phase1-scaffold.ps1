# ============================
# KUTM Phase 1 - Scaffold v0.1
# Target: C:\kingunderthemountain
# Creates directories + starter backend skeleton + infra + tests
# ============================

$Root = "C:\kingunderthemountain"

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p | Out-Null
  }
}

function Write-Utf8NoBom([string]$path, [string]$content) {
  $dir = Split-Path -Path $path -Parent
  Ensure-Dir $dir
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

# --- directory plan
$dirs = @(
  "backend\app\core",
  "backend\app\db",
  "backend\app\middleware",
  "backend\app\modules\identity",
  "backend\app\modules\tenancy",
  "backend\app\modules\rbac",
  "backend\app\modules\audit",
  "backend\app\modules\health",
  "backend\tests",
  "backend\alembic\versions",
  "frontend",
  "infra",
  "docs",
  "scripts",
  "tools"
)

Ensure-Dir $Root
$dirs | ForEach-Object { Ensure-Dir (Join-Path $Root $_) }

# --- .gitignore
Write-Utf8NoBom (Join-Path $Root ".gitignore") @"
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

# --- infra/docker-compose.yml (Postgres only for now)
Write-Utf8NoBom (Join-Path $Root "infra\docker-compose.yml") @"
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

# --- backend requirements
Write-Utf8NoBom (Join-Path $Root "backend\requirements.txt") @"
fastapi==0.115.6
uvicorn[standard]==0.32.1

SQLAlchemy==2.0.36
psycopg[binary]==3.2.3
alembic==1.14.0

pydantic==2.10.3
pydantic-settings==2.6.1

python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

casbin==1.38.0

pytest==8.3.4
httpx==0.28.1

ruff==0.8.2
mypy==1.13.0
bandit==1.7.10
pip-audit==2.7.3
"@

# --- backend .env.example
Write-Utf8NoBom (Join-Path $Root "backend\.env.example") @"
# Copy to .env and adjust as needed
APP_NAME=KingUnderTheMountain
ENV=dev

# SECURITY: change these for real deployments
JWT_SECRET=dev_change_me
JWT_ALG=HS256
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=30

# Postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=kutm
DB_USER=kutm
DB_PASSWORD=password
"@

# --- backend pyproject.toml (ruff + mypy baseline)
Write-Utf8NoBom (Join-Path $Root "backend\pyproject.toml") @"
[tool.ruff]
line-length = 100
target-version = "py311"
select = ["E","F","I","UP","B","SIM"]
ignore = []

[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
disallow_any_generics = true
no_implicit_optional = true
"@

# --- backend app package init
Write-Utf8NoBom (Join-Path $Root "backend\app\__init__.py") ""

# --- core/config.py
Write-Utf8NoBom (Join-Path $Root "backend\app\core\config.py") @"
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
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

settings = Settings()
"@

# --- core/security.py
Write-Utf8NoBom (Join-Path $Root "backend\app\core\security.py") @"
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
    payload: Dict[str, Any] = {"sub": subject, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    if tenant_id:
        payload["tenant_id"] = tenant_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)

def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=settings.refresh_token_days)
    payload: Dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)
"@

# --- db/base.py + session.py
Write-Utf8NoBom (Join-Path $Root "backend\app\db\base.py") @"
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\db\session.py") @"
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

# --- middleware/request_id.py + audit.py stubs
Write-Utf8NoBom (Join-Path $Root "backend\app\middleware\request_id.py") @"
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

Write-Utf8NoBom (Join-Path $Root "backend\app\middleware\audit.py") @"
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # TODO (Phase 2):
        # - Extract user + tenant from auth context
        # - Persist audit log (route, method, status, latency, request_id)
        # - PII-safe: never store full request bodies by default
        response = await call_next(request)
        return response
"@

# --- modules/health/api.py
Write-Utf8NoBom (Join-Path $Root "backend\app\modules\health\api.py") @"
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

# --- identity module (skeleton)
Write-Utf8NoBom (Join-Path $Root "backend\app\modules\identity\models.py") @"
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\modules\identity\schemas.py") @"
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\modules\identity\service.py") @"
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token, create_refresh_token
from app.modules.identity.models import User

def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def issue_tokens(user_id: str, tenant_id: str | None = None) -> tuple[str, str]:
    return create_access_token(subject=user_id, tenant_id=tenant_id), create_refresh_token(subject=user_id)
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\modules\identity\api.py") @"
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.modules.identity.schemas import LoginRequest, RefreshRequest, TokenPair
from app.modules.identity.service import authenticate, issue_tokens

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access, refresh = issue_tokens(user.id)
    return TokenPair(access_token=access, refresh_token=refresh)

@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest) -> TokenPair:
    try:
        decoded = jwt.decode(payload.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_alg])
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        sub = decoded.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    # NOTE: Phase 2 will implement refresh rotation + revocation list.
    access = jwt.encode({"sub": sub}, settings.jwt_secret, algorithm=settings.jwt_alg)
    return TokenPair(access_token=access, refresh_token=payload.refresh_token)
"@

# --- tenancy module (router skeleton + model)
Write-Utf8NoBom (Join-Path $Root "backend\app\modules\tenancy\models.py") @"
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\modules\tenancy\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("")
def list_tenants():
    return {"todo": "list tenants"}

@router.post("")
def create_tenant():
    return {"todo": "create tenant"}

@router.post("/select")
def select_tenant():
    return {"todo": "select tenant context"}
"@

# --- rbac module (Casbin wrapper placeholder)
Write-Utf8NoBom (Join-Path $Root "backend\app\modules\rbac\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/rbac", tags=["rbac"])

@router.get("/roles")
def list_roles():
    return {"todo": "roles list"}

@router.get("/permissions")
def list_permissions():
    return {"todo": "permissions list"}
"@

Write-Utf8NoBom (Join-Path $Root "backend\app\modules\rbac\service.py") @"
# Phase 2: integrate Casbin enforcer + policy storage
# This module remains the wrapper; Casbin remains the engine.
"@

# --- audit module
Write-Utf8NoBom (Join-Path $Root "backend\app\modules\audit\api.py") @"
from fastapi import APIRouter

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("")
def audit_stub():
    return {"todo": "audit log search endpoint (admin-only)"}
"@

# --- router registry (THE guardrail)
Write-Utf8NoBom (Join-Path $Root "backend\app\router.py") @"
from fastapi import FastAPI

from app.modules.health.api import router as health_router
from app.modules.identity.api import router as identity_router
from app.modules.tenancy.api import router as tenancy_router
from app.modules.rbac.api import router as rbac_router
from app.modules.audit.api import router as audit_router

def include_routers(app: FastAPI) -> None:
    # Health first
    app.include_router(health_router)

    # Foundation modules
    app.include_router(identity_router)
    app.include_router(tenancy_router)
    app.include_router(rbac_router)
    app.include_router(audit_router)
"@

# --- main.py
Write-Utf8NoBom (Join-Path $Root "backend\app\main.py") @"
from fastapi import FastAPI

from app.middleware.request_id import RequestIDMiddleware
from app.middleware.audit import AuditMiddleware
from app.router import include_routers

def create_app() -> FastAPI:
    app = FastAPI(title="King Under The Mountain - API")

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(AuditMiddleware)

    include_routers(app)
    return app

app = create_app()
"@

# --- tests: health + route smoke
Write-Utf8NoBom (Join-Path $Root "backend\tests\test_health.py") @"
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
"@

Write-Utf8NoBom (Join-Path $Root "backend\tests\test_routes_smoke.py") @"
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_routes_exist():
    assert client.get("/health").status_code == 200
    assert client.get("/version").status_code == 200

    # If these fail, check: backend/app/router.py
    assert client.post("/auth/login", json={"email": "a@b.com", "password": "x"}).status_code in (401, 422)
    assert client.post("/auth/refresh", json={"refresh_token": "x"}).status_code in (401, 422)
"@

# --- frontend stub
Write-Utf8NoBom (Join-Path $Root "frontend\README.md") @"
# Frontend (planned)
React + TypeScript + Vite, Tailwind + shadcn/ui.
Keep lightweight; the backend is the source of truth.
"@

# --- scripts/dev-run-backend.ps1
Write-Utf8NoBom (Join-Path $Root "scripts\dev-run-backend.ps1") @"
Set-Location C:\kingunderthemountain\backend

if (-not (Test-Path .\.env)) {
  Copy-Item .\.env.example .\.env
  Write-Host "Created backend\.env from .env.example"
}

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\pip.exe install -r requirements.txt

$env:PYTHONPATH = "C:\kingunderthemountain\backend"
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8010 --reload
"@

Write-Host ""
Write-Host "✅ Phase 1 scaffold created at: $Root"
Write-Host ""
Write-Host "Next:"
Write-Host "1) Start Postgres:   docker compose -f C:\kingunderthemountain\infra\docker-compose.yml up -d"
Write-Host "2) Run backend:      C:\kingunderthemountain\scripts\dev-run-backend.ps1"
Write-Host "3) Test endpoints:   http://127.0.0.1:8010/health  and  /docs"
