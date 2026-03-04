from __future__ import annotations

import inspect
import sys
from pathlib import Path
from typing import get_origin

from fastapi.routing import APIRoute

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def is_list_model(model) -> bool:
    if model is None:
        return False
    origin = get_origin(model)
    if origin is list:
        return True
    s = str(model)
    return s.startswith("list[") or s.startswith("typing.List[")


def looks_like_pageresult(model) -> bool:
    if model is None:
        return False
    return "PageResult" in str(model)


def source_sniff(route: APIRoute) -> list[str]:
    flags: list[str] = []
    try:
        src = inspect.getsource(route.endpoint)
    except Exception:
        return flags
    src_l = src.lower()

    if looks_like_pageresult(route.response_model) and "paginate_query" not in src:
        flags.append("SUSPECT:no_paginate_query")
    if ("return [" in src or "return[" in src) and looks_like_pageresult(route.response_model):
        flags.append("SUSPECT:returns_list_literal")
    if ".limit(" in src_l and looks_like_pageresult(route.response_model) and "paginate_query" not in src:
        flags.append("SUSPECT:manual_limit_without_pagination")
    return flags


def main() -> int:
    from app.main import app

    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    routes.sort(key=lambda r: ((sorted(list(r.methods or []))[0] if r.methods else ""), r.path))

    offenders: list[APIRoute] = []
    suspects: list[APIRoute] = []

    print("\n=== ROUTE INVENTORY ===\n")
    for route in routes:
        methods = ",".join(sorted(list(route.methods or [])))
        response_model = str(route.response_model) if route.response_model is not None else "None"
        flags: list[str] = []
        if is_list_model(route.response_model):
            flags.append("LIST_RESPONSE_MODEL")
            offenders.append(route)
        sniff = source_sniff(route)
        if sniff:
            flags.extend(sniff)
            suspects.append(route)

        flag_txt = f"  [{' | '.join(flags)}]" if flags else ""
        print(f"{methods:12} {route.path:45} -> {response_model}{flag_txt}")

    print("\n=== SUMMARY ===\n")
    print(f"Total routes: {len(routes)}")
    print(f"List response_model offenders: {len(offenders)}")
    print(f"PageResult suspects (needs human check): {len({id(r) for r in suspects})}")

    if offenders:
        print("\n=== OFFENDERS: response_model=list[...] ===\n")
        for route in offenders:
            methods = ",".join(sorted(list(route.methods or [])))
            print(f"{methods:12} {route.path}")

    if suspects:
        print("\n=== SUSPECTS: declares PageResult but may not paginate ===\n")
        seen: set[int] = set()
        for route in suspects:
            route_id = id(route)
            if route_id in seen:
                continue
            seen.add(route_id)
            methods = ",".join(sorted(list(route.methods or [])))
            print(f"{methods:12} {route.path}")

    return 2 if offenders else 0


if __name__ == "__main__":
    raise SystemExit(main())

