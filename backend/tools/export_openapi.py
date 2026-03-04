from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _render_openapi() -> str:
    from app.main import create_app

    app = create_app()
    spec = app.openapi()
    return json.dumps(spec, ensure_ascii=True, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export deterministic OpenAPI JSON from backend app."
    )
    parser.add_argument(
        "--out",
        default="frontend/src/api/openapi.json",
        help="Output file path (default: frontend/src/api/openapi.json)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write; fail if output file does not match generated spec.",
    )
    args = parser.parse_args()

    out_path = Path(args.out)
    rendered = _render_openapi()

    if args.check:
        if not out_path.exists():
            raise SystemExit(f"OpenAPI file missing: {out_path}")
        existing = out_path.read_text(encoding="utf-8")
        if existing != rendered:
            raise SystemExit(
                "OpenAPI snapshot is stale. Regenerate with: "
                "python backend/tools/export_openapi.py --out frontend/src/api/openapi.json"
            )
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
