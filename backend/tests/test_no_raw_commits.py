from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = REPO_ROOT / "backend" / "app"

# Transaction boundaries are only allowed in UnitOfWork and bootstrap utilities.
ALLOWED_SUFFIXES = {
    Path("backend/app/core/uow.py"),
    Path("backend/app/modules/ops/api.py"),
}


def _normalized(path: Path) -> str:
    return path.as_posix().lower()


def test_no_raw_commits_in_app_request_paths() -> None:
    offenders: list[str] = []
    for py in APP_ROOT.rglob("*.py"):
        full_norm = _normalized(py)
        if "/migrations/" in full_norm or "/scripts/" in full_norm:
            continue

        rel = py.relative_to(REPO_ROOT)
        if rel in ALLOWED_SUFFIXES:
            continue

        text = py.read_text(encoding="utf-8")
        if ".commit(" in text:
            offenders.append(_normalized(rel))

    assert not offenders, (
        "Raw .commit() calls are forbidden in backend/app request paths. "
        "Use UnitOfWork (get_uow) transaction boundaries instead.\n"
        + "\n".join(offenders)
    )
