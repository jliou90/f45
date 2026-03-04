from __future__ import annotations

import asyncio
import contextlib
import hashlib
import io
import json
import logging
import os
import re
import tarfile
import time
import zipfile
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import docker
import requests
from docker.models.containers import Container
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


BACKUPS_DIR = Path(os.getenv("KUTM_BACKUPS_DIR", "/var/kutm/backups"))
SUPPORT_DIR = Path(os.getenv("KUTM_SUPPORT_DIR", "/var/kutm/support"))
BACKUPS_HOST_DIR = os.getenv("KUTM_BACKUPS_HOST_DIR", r"C:\KUTM\Backups")
SUPPORT_HOST_DIR = os.getenv("KUTM_SUPPORT_HOST_DIR", r"C:\KUTM\Support")
SUPERVISOR_VERSION_FILE = Path(os.getenv("KUTM_VERSION_FILE", "/app/VERSION"))
SELF_HEAL_INTERVAL_SECONDS = int(os.getenv("KUTM_SELF_HEAL_INTERVAL_SECONDS", "15"))
SELF_HEAL_THRESHOLD = int(os.getenv("KUTM_SELF_HEAL_THRESHOLD", "3"))
SELF_HEAL_WINDOW_SECONDS = int(os.getenv("KUTM_SELF_HEAL_WINDOW_SECONDS", "600"))
LOG_TAIL_LINES = int(os.getenv("KUTM_DIAGNOSTICS_LOG_LINES", "250"))
BACKUP_SCHEDULE_ENABLED = os.getenv("KUTM_BACKUP_SCHEDULE_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}
BACKUP_SCHEDULE_INTERVAL_MINUTES = int(os.getenv("KUTM_BACKUP_SCHEDULE_INTERVAL_MINUTES", "1440"))
BACKUP_RETENTION_COUNT = int(os.getenv("KUTM_BACKUP_RETENTION_COUNT", "14"))
RESTORE_CONFIRM_PHRASE = os.getenv("KUTM_RESTORE_CONFIRM_PHRASE", "RESTORE_KUTM")

SERVICE_MAP: dict[str, dict[str, list[str] | str]] = {
    "db": {
        "compose_service": "postgres",
        "container_names": ["kutm_postgres", "kutm_db", "postgres", "db"],
    },
    "api": {
        "compose_service": "api",
        "container_names": ["kutm_api", "api"],
    },
    "web": {
        "compose_service": "web",
        "container_names": ["kutm_web", "web"],
    },
}

logger = logging.getLogger("kutm-supervisor")
logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s","logger":"%(name)s"}',
)


class Envelope(BaseModel):
    ok: bool
    code: str
    message: str
    data: dict | None = None
    request_id: str | None = None


class VerifyBackupRequest(BaseModel):
    path: str | None = Field(default=None, description="Optional .kutmbackup path or filename")


class RestoreBackupRequest(BaseModel):
    path: str
    confirm_phrase: str


class AppState:
    def __init__(self) -> None:
        self.last_errors: dict[str, str | None] = {key: None for key in SERVICE_MAP}
        self.backup_lock = asyncio.Lock()
        self.needs_support = False
        self.self_heal_attempts: dict[str, list[float]] = {key: [] for key in SERVICE_MAP}
        self.self_heal_actions: deque[dict[str, str]] = deque(maxlen=30)
        self.self_heal_task: asyncio.Task | None = None
        self.backup_scheduler_task: asyncio.Task | None = None
        self.last_backup_at: str | None = None
        self.last_backup_error: str | None = None


state = AppState()


def _read_version() -> str:
    try:
        raw = SUPERVISOR_VERSION_FILE.read_text(encoding="utf-8").strip()
        return raw or "0.0.0"
    except OSError:
        return "0.0.0"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _response(request: Request, ok: bool, code: str, message: str, data: dict | None = None, status_code: int = 200) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    payload = Envelope(ok=ok, code=code, message=message, data=data, request_id=req_id)
    return JSONResponse(status_code=status_code, content=payload.model_dump(exclude_none=True))


def _docker_client() -> docker.DockerClient:
    return docker.from_env()


def _container_health(container: Container) -> str | None:
    try:
        container.reload()
        return container.attrs.get("State", {}).get("Health", {}).get("Status")
    except Exception:
        return None


def _resolve_container(client: docker.DockerClient, logical_service: str) -> Container | None:
    if logical_service not in SERVICE_MAP:
        return None

    service_config = SERVICE_MAP[logical_service]
    names = [str(x) for x in service_config["container_names"]]
    compose_service = str(service_config["compose_service"])

    for name in names:
        try:
            return client.containers.get(name)
        except Exception:
            continue

    try:
        matches = client.containers.list(all=True, filters={"label": f"com.docker.compose.service={compose_service}"})
        if matches:
            return matches[0]
    except Exception:
        return None
    return None


def _service_status(client: docker.DockerClient, logical_service: str) -> dict[str, str | None]:
    container = _resolve_container(client, logical_service)
    if container is None:
        return {
            "name": logical_service,
            "container_state": "missing",
            "health": None,
            "last_error": state.last_errors.get(logical_service),
        }

    try:
        container.reload()
        c_state = container.status
        health = _container_health(container) or "unknown"
        return {
            "name": logical_service,
            "container_state": c_state,
            "health": health,
            "last_error": state.last_errors.get(logical_service),
        }
    except Exception as exc:
        state.last_errors[logical_service] = str(exc)
        return {
            "name": logical_service,
            "container_state": "error",
            "health": None,
            "last_error": str(exc),
        }


def _service_is_healthy(status: dict[str, str | None]) -> bool:
    if status.get("container_state") != "running":
        return False
    health = (status.get("health") or "").lower()
    return health in {"", "none", "unknown", "healthy"} or health == "null"


def _backend_readiness() -> dict[str, object]:
    urls = ["http://api:8010/readyz", "http://127.0.0.1:8010/readyz"]
    last_error: str | None = None
    for url in urls:
        try:
            resp = requests.get(url, timeout=2)
            body: object
            try:
                body = resp.json()
            except Exception:
                body = {"raw": resp.text}
            return {"reachable": True, "url": url, "status_code": resp.status_code, "body": body}
        except Exception as exc:
            last_error = str(exc)
    return {"reachable": False, "url": None, "status_code": None, "error": last_error}


def _schema_heads_from_backend() -> dict[str, object]:
    readiness = _backend_readiness()
    body = readiness.get("body")
    if not isinstance(body, dict):
        return {"expected_heads": [], "current_heads": []}
    migrations = body.get("migrations")
    if not isinstance(migrations, dict):
        return {"expected_heads": [], "current_heads": []}
    expected = migrations.get("expected_heads") or []
    current = migrations.get("current_heads") or []
    return {
        "expected_heads": expected if isinstance(expected, list) else [],
        "current_heads": current if isinstance(current, list) else [],
    }


def _status_data() -> dict[str, object]:
    docker_reachable = False
    services: list[dict[str, str | None]] = []
    docker_error: str | None = None
    try:
        client = _docker_client()
        client.ping()
        docker_reachable = True
        services = [_service_status(client, name) for name in ("db", "api", "web")]
    except Exception as exc:
        docker_error = str(exc)
        for name in ("db", "api", "web"):
            services.append(
                {
                    "name": name,
                    "container_state": "unknown",
                    "health": None,
                    "last_error": state.last_errors.get(name) or docker_error,
                }
            )
    readiness = _backend_readiness()
    return {
        "supervisor_version": _read_version(),
        "docker_reachable": docker_reachable,
        "docker_error": docker_error,
        "services": services,
        "readiness": readiness,
        "needs_support": state.needs_support,
        "last_self_heal_actions": list(state.self_heal_actions),
        "backup_scheduler": {
            "enabled": BACKUP_SCHEDULE_ENABLED,
            "interval_minutes": BACKUP_SCHEDULE_INTERVAL_MINUTES,
            "retention_count": BACKUP_RETENTION_COUNT,
            "last_backup_at": state.last_backup_at,
            "last_backup_error": state.last_backup_error,
        },
    }


def _start_service(client: docker.DockerClient, logical_name: str) -> None:
    container = _resolve_container(client, logical_name)
    if container is None:
        raise RuntimeError(f"Container for service '{logical_name}' not found")
    container.reload()
    if container.status != "running":
        container.start()


def _stop_service(client: docker.DockerClient, logical_name: str) -> None:
    container = _resolve_container(client, logical_name)
    if container is None:
        raise RuntimeError(f"Container for service '{logical_name}' not found")
    container.reload()
    if container.status == "running":
        container.stop(timeout=25)


def _wait_service_healthy(client: docker.DockerClient, logical_name: str, timeout_seconds: int = 60) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        status = _service_status(client, logical_name)
        if _service_is_healthy(status):
            return True
        time.sleep(1)
    return False


def _record_self_heal_action(service: str, action: str, result: str, message: str) -> None:
    state.self_heal_actions.append(
        {
            "timestamp": _now_iso(),
            "service": service,
            "action": action,
            "result": result,
            "message": message,
        }
    )


def _within_self_heal_budget(service: str) -> bool:
    now = time.time()
    attempts = [t for t in state.self_heal_attempts.get(service, []) if now - t <= SELF_HEAL_WINDOW_SECONDS]
    state.self_heal_attempts[service] = attempts
    if len(attempts) >= SELF_HEAL_THRESHOLD:
        state.needs_support = True
        return False
    attempts.append(now)
    state.self_heal_attempts[service] = attempts
    return True


def _redact_sensitive(text: str) -> str:
    redacted = re.sub(r"(?i)(password|token|secret)\s*[:=]\s*([^\s,;]+)", r"\1=<redacted>", text)
    redacted = re.sub(r"(?i)authorization:\s*bearer\s+[a-z0-9._-]+", "Authorization: Bearer <redacted>", redacted)
    return redacted


def _parse_env(container: Container) -> dict[str, str]:
    env_out: dict[str, str] = {}
    for raw in container.attrs.get("Config", {}).get("Env", []):
        if "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        env_out[key] = value
    return env_out


def _build_backup() -> dict[str, str | int]:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    client = _docker_client()
    db_container = _resolve_container(client, "db")
    if db_container is None:
        raise RuntimeError("DB container not found")

    db_env = _parse_env(db_container)
    db_user = db_env.get("POSTGRES_USER", "kutm")
    db_name = db_env.get("POSTGRES_DB", "kutm")

    exec_result = db_container.exec_run(["pg_dump", "-Fc", "-U", db_user, db_name], stdout=True, stderr=True)
    if exec_result.exit_code != 0:
        stderr = exec_result.output.decode("utf-8", errors="ignore")
        raise RuntimeError(f"pg_dump failed: {stderr}")

    dump_bytes = bytes(exec_result.output or b"")
    if len(dump_bytes) == 0:
        raise RuntimeError("pg_dump returned empty output")

    created_at = _now_iso()
    filename = f"kutm-backup-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.kutmbackup"
    backup_path = BACKUPS_DIR / filename

    manifest = {
        "product_name": "KUTM",
        "kutm_version": _read_version(),
        "created_at": created_at,
        "format_version": 1,
        "schema_heads": _schema_heads_from_backend(),
        "db_dump_format": "pg_dump_custom",
        "checksums": {
            "db.dump": _sha256_bytes(dump_bytes),
        },
    }
    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")
    checksums_txt = (
        f"{_sha256_bytes(manifest_bytes)}  manifest.json\n"
        f"{_sha256_bytes(dump_bytes)}  db.dump\n"
    ).encode("utf-8")

    with zipfile.ZipFile(backup_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", manifest_bytes)
        archive.writestr("db.dump", dump_bytes)
        archive.writestr("checksums.txt", checksums_txt)

    return {
        "file": filename,
        "container_path": str(backup_path),
        "host_path": str(Path(BACKUPS_HOST_DIR) / filename),
        "size_bytes": backup_path.stat().st_size,
    }


def _prune_old_backups() -> list[str]:
    if BACKUP_RETENTION_COUNT <= 0:
        return []
    candidates = sorted(BACKUPS_DIR.glob("*.kutmbackup"), key=lambda x: x.stat().st_mtime, reverse=True)
    removed: list[str] = []
    for backup in candidates[BACKUP_RETENTION_COUNT:]:
        with contextlib.suppress(OSError):
            backup.unlink()
            removed.append(backup.name)
    return removed


def _latest_backup_file() -> Path:
    candidates = sorted(BACKUPS_DIR.glob("*.kutmbackup"), key=lambda x: x.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("No .kutmbackup files found")
    return candidates[0]


def _resolve_backup_path(path_input: str | None) -> Path:
    if path_input is None or not path_input.strip():
        return _latest_backup_file()
    candidate = Path(path_input)
    if candidate.is_absolute():
        return candidate
    return BACKUPS_DIR / candidate


def _verify_backup(path_input: str | None) -> dict[str, str | int]:
    backup_path = _resolve_backup_path(path_input)
    if not backup_path.exists():
        raise RuntimeError(f"Backup file not found: {backup_path}")

    with zipfile.ZipFile(backup_path, mode="r") as archive:
        names = set(archive.namelist())
        if "manifest.json" not in names:
            raise RuntimeError("manifest.json missing from backup archive")
        if "db.dump" not in names:
            raise RuntimeError("db.dump missing from backup archive")

        manifest_bytes = archive.read("manifest.json")
        db_dump = archive.read("db.dump")
        if len(db_dump) <= 0:
            raise RuntimeError("db.dump is empty")

        manifest = json.loads(manifest_bytes.decode("utf-8"))
        for required_field in ("product_name", "kutm_version", "created_at", "format_version", "schema_heads", "db_dump_format", "checksums"):
            if required_field not in manifest:
                raise RuntimeError(f"manifest missing required field: {required_field}")

        expected_dump_sha = str(manifest.get("checksums", {}).get("db.dump", ""))
        actual_dump_sha = _sha256_bytes(db_dump)
        if expected_dump_sha != actual_dump_sha:
            raise RuntimeError("db.dump checksum mismatch")

        if "checksums.txt" in names:
            checksums_lines = archive.read("checksums.txt").decode("utf-8", errors="ignore").splitlines()
            checksums_map: dict[str, str] = {}
            for line in checksums_lines:
                parts = line.strip().split()
                if len(parts) >= 2:
                    checksums_map[parts[-1]] = parts[0]
            manifest_sha = _sha256_bytes(manifest_bytes)
            if checksums_map.get("manifest.json") and checksums_map.get("manifest.json") != manifest_sha:
                raise RuntimeError("manifest checksum mismatch")
            if checksums_map.get("db.dump") and checksums_map.get("db.dump") != actual_dump_sha:
                raise RuntimeError("checksums.txt db.dump mismatch")

    return {
        "file": backup_path.name,
        "container_path": str(backup_path),
        "host_path": str(Path(BACKUPS_HOST_DIR) / backup_path.name),
        "size_bytes": backup_path.stat().st_size,
    }


def _restore_backup(path_input: str) -> dict[str, str | int]:
    backup_path = _resolve_backup_path(path_input)
    verify = _verify_backup(str(backup_path))

    with zipfile.ZipFile(backup_path, mode="r") as archive:
        dump_bytes = archive.read("db.dump")

    if len(dump_bytes) <= 0:
        raise RuntimeError("db.dump is empty")

    client = _docker_client()
    db_container = _resolve_container(client, "db")
    if db_container is None:
        raise RuntimeError("DB container not found")

    db_env = _parse_env(db_container)
    db_user = db_env.get("POSTGRES_USER", "kutm")
    db_name = db_env.get("POSTGRES_DB", "kutm")

    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode="w") as tar:
        info = tarfile.TarInfo(name="kutm_restore.dump")
        info.size = len(dump_bytes)
        info.mtime = int(time.time())
        tar.addfile(info, io.BytesIO(dump_bytes))
    tar_stream.seek(0)

    uploaded = db_container.put_archive("/tmp", tar_stream.getvalue())
    if not uploaded:
        raise RuntimeError("Failed to upload dump into DB container")

    restore_cmd = [
        "pg_restore",
        "-U",
        db_user,
        "-d",
        db_name,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "/tmp/kutm_restore.dump",
    ]
    restore_result = db_container.exec_run(restore_cmd, stdout=True, stderr=True)
    db_container.exec_run(["rm", "-f", "/tmp/kutm_restore.dump"], stdout=False, stderr=False)
    if restore_result.exit_code != 0:
        err = restore_result.output.decode("utf-8", errors="ignore")
        raise RuntimeError(f"pg_restore failed: {err}")

    return {
        "file": str(verify["file"]),
        "container_path": str(verify["container_path"]),
        "host_path": str(verify["host_path"]),
        "size_bytes": int(verify["size_bytes"]),
    }


def _collect_diagnostics() -> dict[str, str | int]:
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    created_name = f"kutm-support-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.zip"
    diag_path = SUPPORT_DIR / created_name

    status_snapshot = _status_data()
    docker_version: dict[str, object] = {"reachable": False}
    service_logs: dict[str, str] = {}

    try:
        client = _docker_client()
        docker_version = client.version()
        for service_name in ("db", "api", "web"):
            container = _resolve_container(client, service_name)
            if container is None:
                service_logs[service_name] = "container not found"
                continue
            log_text = container.logs(tail=LOG_TAIL_LINES).decode("utf-8", errors="ignore")
            service_logs[service_name] = _redact_sensitive(log_text)
    except Exception as exc:
        docker_version = {"reachable": False, "error": str(exc)}

    backend_data: dict[str, object] = {}
    for name, url in {
        "version": "http://api:8010/api/v1/ops/version",
        "readyz": "http://api:8010/readyz",
    }.items():
        try:
            resp = requests.get(url, timeout=2)
            try:
                payload: object = resp.json()
            except Exception:
                payload = {"raw": resp.text}
            backend_data[name] = {"status_code": resp.status_code, "body": payload}
        except Exception as exc:
            backend_data[name] = {"error": str(exc)}

    with zipfile.ZipFile(diag_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("status_snapshot.json", json.dumps(status_snapshot, indent=2, default=str))
        archive.writestr("docker_version.json", json.dumps(docker_version, indent=2, default=str))
        archive.writestr("backend_snapshot.json", json.dumps(backend_data, indent=2, default=str))
        for service_name, logs in service_logs.items():
            archive.writestr(f"logs/{service_name}.log", logs)

    return {
        "file": created_name,
        "container_path": str(diag_path),
        "host_path": str(Path(SUPPORT_HOST_DIR) / created_name),
        "size_bytes": diag_path.stat().st_size,
    }


async def _self_heal_loop() -> None:
    while True:
        await asyncio.sleep(SELF_HEAL_INTERVAL_SECONDS)
        if state.backup_lock.locked():
            continue
        try:
            client = _docker_client()
            client.ping()
        except Exception as exc:
            _record_self_heal_action("docker", "ping", "skipped", f"docker unavailable: {exc}")
            continue

        db_status = _service_status(client, "db")
        api_status = _service_status(client, "api")

        if not _service_is_healthy(db_status):
            if _within_self_heal_budget("db"):
                try:
                    container = _resolve_container(client, "db")
                    if container is None:
                        raise RuntimeError("db container missing")
                    container.restart(timeout=30)
                    _record_self_heal_action("db", "restart", "ok", "Restarted DB due to unhealthy state")
                except Exception as exc:
                    _record_self_heal_action("db", "restart", "error", str(exc))
            else:
                _record_self_heal_action("db", "restart", "blocked", "Self-heal budget exceeded")
            continue

        if not _service_is_healthy(api_status):
            if _within_self_heal_budget("api"):
                try:
                    container = _resolve_container(client, "api")
                    if container is None:
                        raise RuntimeError("api container missing")
                    container.restart(timeout=30)
                    _record_self_heal_action("api", "restart", "ok", "Restarted API due to unhealthy state")
                except Exception as exc:
                    _record_self_heal_action("api", "restart", "error", str(exc))
            else:
                _record_self_heal_action("api", "restart", "blocked", "Self-heal budget exceeded")


async def _run_backup_job(trigger: str) -> dict[str, object]:
    async with state.backup_lock:
        details = await asyncio.to_thread(_build_backup)
        removed = await asyncio.to_thread(_prune_old_backups)
        state.last_backup_at = _now_iso()
        state.last_backup_error = None
        details["removed_old_backups"] = removed
        details["trigger"] = trigger
        return details


async def _backup_scheduler_loop() -> None:
    sleep_seconds = max(60, BACKUP_SCHEDULE_INTERVAL_MINUTES * 60)
    logger.info("backup_scheduler_started interval_minutes=%s retention_count=%s", BACKUP_SCHEDULE_INTERVAL_MINUTES, BACKUP_RETENTION_COUNT)
    while True:
        await asyncio.sleep(sleep_seconds)
        try:
            result = await _run_backup_job("schedule")
            logger.info("scheduled_backup_completed file=%s", result["file"])
        except Exception as exc:
            state.last_backup_error = str(exc)
            logger.error("scheduled_backup_failed error=%s", str(exc))


app = FastAPI(title="KUTM Supervisor")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


@app.on_event("startup")
async def on_startup() -> None:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    state.self_heal_task = asyncio.create_task(_self_heal_loop())
    if BACKUP_SCHEDULE_ENABLED:
        state.backup_scheduler_task = asyncio.create_task(_backup_scheduler_loop())
    logger.info("supervisor_started version=%s", _read_version())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if state.self_heal_task:
        state.self_heal_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await state.self_heal_task
    if state.backup_scheduler_task:
        state.backup_scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await state.backup_scheduler_task


@app.get("/status")
async def status(request: Request) -> JSONResponse:
    return _response(request, ok=True, code="status_ok", message="Status collected", data=_status_data())


@app.post("/stack/start")
async def stack_start(request: Request) -> JSONResponse:
    errors: list[str] = []
    try:
        client = _docker_client()
        for logical in ("db", "api", "web"):
            try:
                _start_service(client, logical)
                _wait_service_healthy(client, logical, timeout_seconds=90 if logical == "db" else 60)
            except Exception as exc:
                errors.append(f"{logical}: {exc}")
                state.last_errors[logical] = str(exc)
    except Exception as exc:
        return _response(request, ok=False, code="docker_unreachable", message=str(exc), status_code=503)

    if errors:
        return _response(
            request,
            ok=False,
            code="stack_start_partial",
            message="Stack start completed with errors",
            data={"errors": errors},
            status_code=207,
        )
    return _response(request, ok=True, code="stack_started", message="Stack start completed")


@app.post("/stack/stop")
async def stack_stop(request: Request) -> JSONResponse:
    errors: list[str] = []
    try:
        client = _docker_client()
        for logical in ("web", "api", "db"):
            try:
                _stop_service(client, logical)
            except Exception as exc:
                errors.append(f"{logical}: {exc}")
                state.last_errors[logical] = str(exc)
    except Exception as exc:
        return _response(request, ok=False, code="docker_unreachable", message=str(exc), status_code=503)

    if errors:
        return _response(
            request,
            ok=False,
            code="stack_stop_partial",
            message="Stack stop completed with errors",
            data={"errors": errors},
            status_code=207,
        )
    return _response(request, ok=True, code="stack_stopped", message="Stack stop completed")


@app.post("/stack/restart")
async def stack_restart(request: Request) -> JSONResponse:
    stop_resp = await stack_stop(request)
    if stop_resp.status_code >= 400:
        return stop_resp
    return await stack_start(request)


@app.post("/backup")
async def backup(request: Request) -> JSONResponse:
    if state.backup_lock.locked():
        return _response(request, ok=False, code="backup_in_progress", message="Backup already running", status_code=409)
    try:
        result = await _run_backup_job("manual")
        return _response(request, ok=True, code="backup_created", message="Backup created", data=result)
    except Exception as exc:
        state.last_backup_error = str(exc)
        return _response(request, ok=False, code="backup_failed", message=str(exc), status_code=500)


@app.post("/backup/verify")
async def backup_verify(request: Request, payload: VerifyBackupRequest | None = None) -> JSONResponse:
    try:
        details = await asyncio.to_thread(_verify_backup, payload.path if payload else None)
        return _response(request, ok=True, code="backup_verified", message="Backup verified", data=details)
    except Exception as exc:
        return _response(request, ok=False, code="backup_verify_failed", message=str(exc), status_code=400)


@app.post("/restore")
async def restore(request: Request, payload: RestoreBackupRequest) -> JSONResponse:
    if payload.confirm_phrase != RESTORE_CONFIRM_PHRASE:
        return _response(
            request,
            ok=False,
            code="restore_confirmation_failed",
            message="Restore confirmation phrase mismatch",
            status_code=400,
        )
    if state.backup_lock.locked():
        return _response(request, ok=False, code="backup_in_progress", message="Backup/restore already running", status_code=409)

    async with state.backup_lock:
        try:
            details = await asyncio.to_thread(_restore_backup, payload.path)
            return _response(
                request,
                ok=True,
                code="restore_completed",
                message="Restore completed",
                data={"restored": details, "dev_only": True},
            )
        except Exception as exc:
            return _response(request, ok=False, code="restore_failed", message=str(exc), status_code=500)


@app.post("/diagnostics")
async def diagnostics(request: Request) -> JSONResponse:
    try:
        details = await asyncio.to_thread(_collect_diagnostics)
        return _response(request, ok=True, code="diagnostics_created", message="Diagnostics bundle created", data=details)
    except Exception as exc:
        return _response(request, ok=False, code="diagnostics_failed", message=str(exc), status_code=500)
