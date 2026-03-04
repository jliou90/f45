from __future__ import annotations

from types import SimpleNamespace

import pytest
from app.core.errors import AppError
from app.core.rbac import require_tenant_role as rbac_require_tenant_role
from app.core.tenancy.deps import require_tenant_role


def _request_with_role(role: str):
    return SimpleNamespace(state=SimpleNamespace(tenant_role=role))


def test_require_tenant_role_is_case_insensitive() -> None:
    dep = require_tenant_role("admin")

    assert dep(_request_with_role("ADMIN")) == "ADMIN"
    assert dep(_request_with_role("admin")) == "ADMIN"
    assert dep(_request_with_role("AdMiN")) == "ADMIN"


def test_rbac_shim_points_to_canonical_helper() -> None:
    assert rbac_require_tenant_role is require_tenant_role

    dep = rbac_require_tenant_role("ADMIN")
    assert dep(_request_with_role("admin")) == "ADMIN"

    with pytest.raises(AppError):
        dep(_request_with_role("member"))
