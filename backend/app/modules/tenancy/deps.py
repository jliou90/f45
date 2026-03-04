"""Backwards-compatible tenancy dependency shim.

Patch 2 canonical deps live in `app.core.tenancy.deps`.
This module exists so older modules can keep importing
`app.modules.tenancy.deps` without scattering tenancy logic.
"""

from __future__ import annotations

from app.core.tenancy.deps import (
    get_current_tenant_id,
)

# backwards-compatible names
get_tenant_id = get_current_tenant_id
