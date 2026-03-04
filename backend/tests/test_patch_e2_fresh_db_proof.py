from __future__ import annotations

import os
import socket
import subprocess
from pathlib import Path

import pytest


def test_fresh_db_upgrade_and_constraints_proof() -> None:
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "5432"))
    try:
        with socket.create_connection((host, port), timeout=1.0):
            pass
    except OSError:
        pytest.skip(f"Postgres not reachable at {host}:{port}")

    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / "backend"

    subprocess.run(["python", "-m", "alembic", "upgrade", "head"], cwd=backend_dir, check=True)
    subprocess.run(["python", "tools/prove_constraints.py"], cwd=backend_dir, check=True)
