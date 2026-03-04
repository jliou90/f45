from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCAN_DIRS = (
    ROOT / "backend" / "app",
    ROOT / "backend" / "tests",
    ROOT / "docs",
    ROOT / "frontend" / "src",
)
EXCLUDE_FILES = {
    ROOT / "backend" / "tests" / "test_api_surface_freeze.py",
}
PATTERNS = [
    re.compile(r'"/api/auth/(login|refresh)"'),
    re.compile(r'"/api/v(?!1\b)\d+/auth/(login|refresh)"'),
    re.compile(r'"/auth/(login|refresh)"'),
]


def _iter_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    return [p for p in base.rglob("*") if p.is_file() and p.suffix in {".py", ".md", ".ts", ".tsx"}]


def main() -> int:
    violations: list[tuple[Path, int, str]] = []
    for scan_dir in SCAN_DIRS:
        for path in _iter_files(scan_dir):
            if path in EXCLUDE_FILES:
                continue
            rel = path.relative_to(ROOT)
            text = path.read_text(encoding="utf-8", errors="ignore")
            for idx, line in enumerate(text.splitlines(), start=1):
                # Frontend uses baseUrl ".../api/v1" + relative "/auth/*" request paths.
                if rel.parts[:2] == ("frontend", "src") and '"/auth/' in line:
                    continue
                for pattern in PATTERNS:
                    if pattern.search(line):
                        violations.append((path, idx, line.strip()))

    if violations:
        print("Legacy auth route reference(s) found. Use /api/v1/auth/* for absolute API paths.", file=sys.stderr)
        for path, line_no, line in violations:
            rel = path.relative_to(ROOT)
            print(f"- {rel}:{line_no}: {line}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
