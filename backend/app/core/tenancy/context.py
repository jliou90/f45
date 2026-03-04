from __future__ import annotations

from fastapi import Request


def get_tenant_id_from_request(request: Request) -> str | None:
    # prefer explicit header
    tid = request.headers.get("X-Tenant-Id")
    if tid:
        return tid.strip() or None

    # fallback: if auth middleware/deps set it
    return getattr(request.state, "tenant_id", None)