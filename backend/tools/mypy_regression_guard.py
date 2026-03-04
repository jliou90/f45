from __future__ import annotations

import argparse
import re
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Fail if mypy error count regresses above baseline.")
    parser.add_argument("--max-errors", type=int, required=True, help="Maximum allowed mypy error count")
    parser.add_argument(
        "--target",
        default="app",
        help="Mypy target path/module (default: app)",
    )
    args = parser.parse_args()

    proc = subprocess.run(
        [sys.executable, "-m", "mypy", args.target],
        capture_output=True,
        text=True,
        check=False,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    if "Success: no issues found" in output:
        print("mypy errors: 0 (max allowed: %s)" % args.max_errors)
        return 0

    match = re.search(r"Found (\d+) errors? in \d+ files?", output)
    if match is None:
        print("Unable to parse mypy output:")
        print(output)
        return 2

    count = int(match.group(1))
    print(f"mypy errors: {count} (max allowed: {args.max_errors})")
    if count > args.max_errors:
        print(output)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
