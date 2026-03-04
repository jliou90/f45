from __future__ import annotations

from collections.abc import Callable

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.tenancy.context import get_tenant_id_from_request
from app.db.session import get_db
from app.modules.tenancy import service as tenancy_service
from app.modules.tenancy.models import Tenant
from fastapi import Depends, Request
from sqlalchemy.orm import Session


def require_tenant_id(request: Request) -> str:
    tenant_id = get_tenant_id_from_request(request)
    if not tenant_id:
        raise AppError(code="tenant_missing", message="Missing X-Tenant-Id header", status_code=400)
    return tenant_id


def get_current_tenant(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> Tenant:
    """
    Resolves and validates the tenant context using:
      - X-Tenant-Id header
      - authenticated user membership

    Side-effects:
      - request.state.tenant_id
      - request.state.tenant_role  (normalized to UPPERCASE)
    """
    tenant_id = require_tenant_id(request)

    tenant = tenancy_service.get_tenant(db, tenant_id)
    if not tenant:
        raise AppError(
            code="tenant_not_found",
            message="Tenant not found",
            status_code=404,
        )

    membership = tenancy_service.get_membership(db, tenant_id=tenant_id, user_id=user.id)
    if not membership:
        raise AppError(
            # Match unknown-tenant behavior to avoid leaking tenant existence.
            code="tenant_not_found",
            message="Tenant not found",
            status_code=404,
        )

    # Normalize roles so "admin" and "ADMIN" behave the same everywhere.
    role = (getattr(membership, "role", None) or "").upper()

    request.state.tenant_role = role
    request.state.tenant_id = tenant_id
    request.state.user_id = user.id
    request.state.membership_role_id = getattr(membership, "role_id", None)
    return tenant


def get_current_tenant_id(tenant: Tenant = Depends(get_current_tenant)) -> str:
    return tenant.id


def require_tenant_role(*allowed: str) -> Callable[[Request], str]:
    """
    Enforces that get_current_tenant() has already run for this request
    and that the resolved tenant_role is in the allowed set.

    Usage:
        _ = Depends(require_tenant_role("ADMIN"))
    """
    # Normalize allowed roles once (UPPERCASE)
    allowed_norm = [a.upper() for a in allowed]
    allowed_set = set(allowed_norm)

    def _inner(
        request: Request,
        _tenant: Tenant = Depends(get_current_tenant),
    ) -> str:
        role = (getattr(request.state, "tenant_role", None) or "").upper()
        if not role:
            raise AppError(code="tenant_context_missing", message="Tenant context not resolved", status_code=400)

        if role not in allowed_set:
            raise AppError(
                code="permission_denied",
                message="Insufficient permissions",
                status_code=403,
                details={"required_roles": allowed_norm, "role": role},
            )
        return role

    return _inner
