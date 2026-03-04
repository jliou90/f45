from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def test_alembic_has_single_head() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "heads"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        check=True,
    )
    head_lines = [line for line in proc.stdout.splitlines() if "(head)" in line]
    assert len(head_lines) == 1, f"expected exactly one alembic head, got {len(head_lines)}: {head_lines}"


def test_all_migrations_define_downgrade() -> None:
    versions_dir = Path(__file__).resolve().parents[1] / "migrations" / "versions"
    missing: list[str] = []
    empty: list[str] = []
    for file in versions_dir.glob("*.py"):
        text = file.read_text(encoding="utf-8")
        signature = re.search(r"def\s+downgrade\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:", text)
        if not signature:
            missing.append(file.name)
            continue
        match = re.search(r"def\s+downgrade\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:\s*([\s\S]*)", text)
        body = (match.group(1) if match else "").strip()
        if not body:
            empty.append(file.name)
    assert not missing, f"migrations missing downgrade(): {missing}"
    assert not empty, f"migrations with empty downgrade() body: {empty}"
