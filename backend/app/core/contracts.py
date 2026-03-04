from __future__ import annotations

from typing import Any, get_origin

from fastapi import FastAPI
from fastapi.routing import APIRoute


def _is_list_response_model(model: Any) -> bool:
    if model is None:
        return False
    origin = get_origin(model)
    if origin is list:
        return True
    s = str(model)
    return s.startswith("list[") or s.startswith("typing.List[")


def enforce_no_list_response_models(app: FastAPI) -> None:
    offenders: list[str] = []
    for r in app.routes:
        if not isinstance(r, APIRoute):
            continue
        if _is_list_response_model(getattr(r, "response_model", None)):
            methods = ",".join(sorted(list(r.methods or [])))
            offenders.append(f"{methods} {r.path}")

    if offenders:
        msg = "List response models are forbidden. Use PageResult[T] instead. Offenders:\\n" + "\\n".join(offenders)
        raise RuntimeError(msg)
