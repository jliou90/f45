from __future__ import annotations

import os
import re
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings

_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def _env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _normalized_semver(value: str | None) -> str:
    if value and _SEMVER_RE.match(value):
        return value
    return "0.1.0"


def _normalized_git_sha(value: str | None) -> str | None:
    if value and _SHA_RE.match(value):
        return value.lower()
    return None


def canonical_version() -> str:
    env_raw = _env("APP_VERSION")
    if env_raw and _SEMVER_RE.match(env_raw):
        return env_raw

    root_version_file = Path(__file__).resolve().parents[3] / "VERSION"
    try:
        raw = root_version_file.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.1.0"
    return _normalized_semver(raw)


def build_info() -> dict[str, str | None]:
    app_env = (_env("APP_ENV") or _env("ENV") or str(settings.env)).lower()
    version = canonical_version()
    git_sha = _normalized_git_sha(_env("GIT_SHA"))
    build_time = _env("BUILD_TIME") or datetime.now(UTC).isoformat()

    return {
        "service": "kutm-backend",
        "app": settings.app_name,
        "env": app_env,
        "version": version,
        "git_sha": git_sha,
        "build_time": build_time,
    }
