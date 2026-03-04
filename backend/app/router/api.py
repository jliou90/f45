from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from fastapi import APIRouter, Depends
from fastapi.exceptions import FastAPIError

from app.core.tenancy.deps import get_current_tenant
from app.modules.accounting.api import router as accounting_router
from app.modules.admin.api import router as admin_router
from app.modules.audit.api import router as audit_router
from app.modules.deals.api import router as deals_router
from app.modules.dms.api import router as dms_router
from app.modules.documents.api import router as documents_router
from app.modules.eventstore.api import router as eventstore_router
from app.modules.funding.api import router as funding_router
from app.modules.health.api import router as health_router
from app.modules.identity.api import router as identity_router
from app.modules.integrations.api import router as integrations_router
from app.modules.inventory.api import router as inventory_router
from app.modules.io.api import router as io_router
from app.modules.jobs.api import router as jobs_router
from app.modules.ops.api import router as ops_router
from app.modules.platform.routes import router as platform_router
from app.modules.rbac.api import router as rbac_router
from app.modules.selfheal.api import router as selfheal_router
from app.modules.service_ro.api import router as service_router
from app.modules.tenancy.api import router as tenancy_router

# ---------------- mount spec ----------------

@dataclass(frozen=True)
class RouteMount:
    """
    Declarative mount spec.

    Supports TWO module styles:
      A) module router defines its own prefix (common today)
      B) composition root defines the prefix (future goal)

    We therefore:
      - default prefix=""
      - provide fallback_prefix for routers that define operations at path=""
      - allow force_prefix=True to prevent dangerous root pollution (e.g. "/{doc_type}")
    """

    router: APIRouter
    prefix: str = ""
    tags: Sequence[str] | None = None
    tenant_required: bool = False
    fallback_prefix: str | None = None
    force_prefix: bool = False


def _mount(root: APIRouter, spec: RouteMount) -> None:
    deps = [Depends(get_current_tenant)] if spec.tenant_required else None
    tags = list(spec.tags) if spec.tags else None

    def do_include(prefix: str) -> None:
        root.include_router(
            spec.router,
            prefix=prefix,
            tags=tags,
            dependencies=deps,
        )

    # If forced, never mount at "".
    if spec.force_prefix:
        first = spec.prefix or (spec.fallback_prefix or "")
        if not first:
            raise RuntimeError("force_prefix=True requires prefix or fallback_prefix")
        do_include(first)
        return

    # Normal path: try prefix first, then fallback_prefix if FastAPI complains.
    try:
        do_include(spec.prefix)
    except FastAPIError as e:
        msg = str(e)
        if "Prefix and path cannot be both empty" in msg and spec.fallback_prefix:
            do_include(spec.fallback_prefix)
            return
        raise


# ---------------- safety audit ----------------

def _iter_routes(router: APIRouter) -> Iterable[tuple[str, str]]:
    """Yield (METHOD, PATH) for mounted routes."""
    for r in router.routes:
        methods = getattr(r, "methods", None)
        path = getattr(r, "path", None)
        if not methods or not path:
            continue
        for m in methods:
            if m in {"HEAD", "OPTIONS"}:
                continue
            yield (m.upper(), path)


def _assert_no_duplicate_method_paths(router: APIRouter) -> None:
    seen: dict[tuple[str, str], int] = {}
    for key in _iter_routes(router):
        seen[key] = seen.get(key, 0) + 1

    dupes = [(k, n) for k, n in seen.items() if n > 1]
    if not dupes:
        return

    lines = ["Duplicate routes detected (METHOD PATH):"]
    for (method, path), n in sorted(dupes, key=lambda x: (x[0][1], x[0][0])):
        lines.append(f"  {n}x {method:6} {path}")
    raise RuntimeError("\n".join(lines))


# ---------------- composition root ----------------

def build_api_router(*, api_prefix: str = "") -> APIRouter:
    """
    Composition root for HTTP API.

    10-year goals:
    - Prevent accidental root wildcard routes (e.g., "/{doc_type}") from polluting the API.
    - Keep URL surface stable for frontend consumers.
    - Support mixed module conventions without forcing a refactor today.
    - Centralize tenant scoping consistently where desired.
    - Allow easy versioning by setting api_prefix="/api/v1".
    """
    root = APIRouter(prefix=api_prefix)

    mounts: list[RouteMount] = [
        # --- Public / bootstrap ---
        RouteMount(health_router, tags=("health",)),
        RouteMount(identity_router, tags=("auth",)),
        RouteMount(tenancy_router, tags=("tenants",)),

        # --- Foundation (tenant-scoped) ---
        RouteMount(rbac_router, tenant_required=True, tags=("rbac",)),
        RouteMount(audit_router, tenant_required=True, tags=("audit",)),

        # --- Core domain (tenant-scoped) ---
        RouteMount(dms_router, tenant_required=True, tags=("dms",)),
        RouteMount(service_router, tenant_required=True, tags=("service",)),
        RouteMount(deals_router, tenant_required=True, tags=("deals",)),
        RouteMount(inventory_router, tenant_required=True, tags=("inventory",)),
        RouteMount(accounting_router, tenant_required=True, tags=("acct",)),
        RouteMount(funding_router, tenant_required=True, tags=("funding",)),
        RouteMount(jobs_router, tenant_required=True, tags=("jobs",)),

        # --- Ops / integrations ---
        # CRITICAL: ops/bootstrap must work *before* a tenant exists.
        # So ops is NOT tenant-scoped at mount-time.
        RouteMount(integrations_router, tenant_required=True, tags=("integrations",)),
        RouteMount(ops_router, tenant_required=False, tags=("ops",)),

        # --- Platform (tenant-scoped / privileged) ---
        RouteMount(platform_router, tenant_required=True, tags=("platform",)),
        RouteMount(admin_router, tenant_required=True, tags=("admin",)),

        # --- Backbone / tooling ---
        RouteMount(
            eventstore_router,
            tenant_required=True,
            tags=("events",),
            fallback_prefix="/events",
            force_prefix=True,
        ),
        RouteMount(
            documents_router,
            tenant_required=True,
            tags=("docs",),
            fallback_prefix="/docs",
            force_prefix=True,
        ),
        RouteMount(
            io_router,
            tenant_required=True,
            tags=("io",),
            fallback_prefix="/io",
            force_prefix=True,
        ),
        RouteMount(
            selfheal_router,
            tenant_required=True,
            tags=("selfheal",),
            fallback_prefix="/selfheal",
            force_prefix=True,
        ),
    ]

    for spec in mounts:
        _mount(root, spec)

    _assert_no_duplicate_method_paths(root)
    return root

api_router = build_api_router(api_prefix="/api/v1")
