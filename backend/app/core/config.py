import os
from enum import Enum
from pathlib import Path
from urllib.parse import urlparse

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_DIR / ".env"


class AppEnv(str, Enum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"


def _normalize_env(value: str | AppEnv | None) -> AppEnv:
    if isinstance(value, AppEnv):
        return value
    raw = (value or "").strip().lower()
    if raw in {"dev", "development", "local"}:
        return AppEnv.DEV
    if raw in {"test", "testing"}:
        return AppEnv.TEST
    if raw in {"prod", "production"}:
        return AppEnv.PROD
    return AppEnv.DEV


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        populate_by_name=True,
    )

    # App
    app_name: str = Field(default="KingUnderTheMountain", alias="APP_NAME")
    env: AppEnv = Field(default=AppEnv.DEV, alias="ENV")

    # Auth / JWT
    jwt_secret: str = Field(default="dev_change_me", alias="JWT_SECRET")
    jwt_alg: str = Field(default="HS256", alias="JWT_ALG")
    access_token_minutes: int = Field(default=15, alias="ACCESS_TOKEN_MINUTES")
    refresh_token_days: int = Field(default=30, alias="REFRESH_TOKEN_DAYS")
    login_lockout_enabled: bool = Field(default=False, alias="LOGIN_LOCKOUT_ENABLED")
    login_lockout_threshold: int = Field(default=5, alias="LOGIN_LOCKOUT_THRESHOLD")
    login_lockout_minutes: int = Field(default=15, alias="LOGIN_LOCKOUT_MINUTES")

    # Ops / Bootstrap
    bootstrap_token: str | None = Field(default=None, alias="BOOTSTRAP_TOKEN")
    bootstrap_enabled: bool = Field(default=False, alias="BOOTSTRAP_ENABLED")

    # Database
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    db_host: str = Field(default="127.0.0.1", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="kutm", alias="DB_NAME")
    db_user: str = Field(default="kutm", alias="DB_USER")
    db_password: str = Field(default="password", alias="DB_PASSWORD")

    @property
    def runtime_env(self) -> AppEnv:
        return _normalize_env(os.getenv("APP_ENV") or os.getenv("ENV") or self.env)

    @staticmethod
    def _is_strong_secret(secret: str | None, *, min_len: int = 32) -> bool:
        if not secret:
            return False
        return len(secret.strip()) >= min_len

    @staticmethod
    def _is_placeholder_secret(secret: str | None) -> bool:
        if secret is None:
            return False
        normalized = secret.strip().lower()
        return normalized in {
            "",
            "change_me",
            "dev_change_me",
            "replace_me",
            "your_bootstrap_token_here",
            "bootstrap_change_me",
            "changeme",
        }

    def validate_runtime(self) -> None:
        bootstrap_raw = (self.bootstrap_token or "").strip()
        if bootstrap_raw and self._is_placeholder_secret(self.bootstrap_token):
            raise RuntimeError("Invalid configuration: BOOTSTRAP_TOKEN cannot use a placeholder value.")

        env = self.runtime_env
        if env is not AppEnv.PROD:
            return

        errors: list[str] = []

        if self._is_placeholder_secret(self.jwt_secret) or not self._is_strong_secret(self.jwt_secret):
            errors.append("JWT_SECRET must be at least 32 characters in prod.")
        if self.access_token_minutes <= 0:
            errors.append("ACCESS_TOKEN_MINUTES must be greater than 0.")
        if self.refresh_token_days <= 0:
            errors.append("REFRESH_TOKEN_DAYS must be greater than 0.")
        if self.login_lockout_threshold < 1:
            errors.append("LOGIN_LOCKOUT_THRESHOLD must be >= 1.")
        if self.login_lockout_minutes < 1:
            errors.append("LOGIN_LOCKOUT_MINUTES must be >= 1.")

        db_url = self.sqlalchemy_database_url
        parsed = urlparse(db_url)
        if parsed.scheme.startswith("sqlite"):
            errors.append("DATABASE_URL/sqlalchemy_database_url cannot use sqlite in prod.")

        token_enabled = self.bootstrap_enabled or bool((self.bootstrap_token or "").strip())
        if token_enabled and not self._is_strong_secret(self.bootstrap_token):
            errors.append(
                "BOOTSTRAP_TOKEN must be at least 32 characters when bootstrap is enabled in prod."
            )

        if errors:
            raise RuntimeError("Invalid production configuration: " + " ".join(errors))

    # --- DATABASE URLS ---

    # Use this for SQLAlchemy / Alembic
    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    # Use this ONLY for psycopg.connect(...)
    @property
    def psycopg_database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()


def validate_runtime_settings() -> None:
    # Load fresh values so startup validation reflects current environment.
    Settings().validate_runtime()
