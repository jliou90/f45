from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

from fastapi.routing import APIRoute

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

API_INDEX_PATH = ROOT / "docs" / "API_INDEX.md"


@dataclass(frozen=True)
class DocRoute:
    method: str
    path: str
    source: str
    wildcard: bool
    line_no: int


def _normalize_source(path: str) -> str:
    return path.strip().replace("\\", "/")


def _load_live_routes() -> dict[tuple[str, str], str]:
    from app.main import create_app

    app = create_app()
    routes: dict[tuple[str, str], str] = {}
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        path = getattr(route, "path", "")
        methods = set(getattr(route, "methods", set()) or set())
        endpoint = getattr(route, "endpoint", None)
        source_file = (
            Path(endpoint.__code__.co_filename).resolve().as_posix() if endpoint is not None else ""
        )
        try:
            source_rel = Path(source_file).relative_to(ROOT).as_posix()
        except Exception:
            source_rel = source_file
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            routes[(method.upper(), path)] = source_rel
    return routes


def _parse_doc_routes() -> list[DocRoute]:
    if not API_INDEX_PATH.exists():
        raise SystemExit(f"API index file missing: {API_INDEX_PATH}")
    text = API_INDEX_PATH.read_text(encoding="utf-8")
    doc_routes: list[DocRoute] = []
    line_re = re.compile(r"^\s*-\s+`([^`]+)`\s*->\s*`([^`]+)`\s*$")
    for line_no, line in enumerate(text.splitlines(), start=1):
        m = line_re.match(line)
        if not m:
            continue
        left, source = m.group(1), m.group(2)
        source = _normalize_source(source)
        parts = left.split(" ", 1)
        if len(parts) != 2:
            continue
        methods_raw, path = parts
        wildcard = path.endswith("*")
        normalized_path = path[:-1] if wildcard else path
        methods = [p.strip().upper() for p in methods_raw.split("|") if p.strip()]
        for method in methods:
            doc_routes.append(
                DocRoute(
                    method=method,
                    path=normalized_path,
                    source=source,
                    wildcard=wildcard,
                    line_no=line_no,
                )
            )
    return doc_routes


def main() -> int:
    live = _load_live_routes()
    docs = _parse_doc_routes()
    errors: list[str] = []

    for entry in docs:
        matches: list[tuple[tuple[str, str], str]] = []
        if entry.wildcard:
            for key, src in live.items():
                method, path = key
                if method == entry.method and path.startswith(entry.path):
                    matches.append((key, src))
        else:
            src = live.get((entry.method, entry.path))
            if src is not None:
                matches.append(((entry.method, entry.path), src))

        if not matches:
            errors.append(
                f"{API_INDEX_PATH.relative_to(ROOT)}:{entry.line_no}: missing live route for "
                f"{entry.method} {entry.path}{'*' if entry.wildcard else ''}"
            )
            continue

        for (method, path), src in matches:
            if src != entry.source:
                errors.append(
                    f"{API_INDEX_PATH.relative_to(ROOT)}:{entry.line_no}: source mismatch for "
                    f"{method} {path} -> docs `{entry.source}` vs live `{src}`"
                )

    if errors:
        print("API index drift detected.", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

