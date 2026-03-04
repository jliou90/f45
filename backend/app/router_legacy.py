from fastapi import FastAPI

from app.modules.audit.api import router as audit_router
from app.modules.dms.api import router as dms_router
from app.modules.health.api import router as health_router
from app.modules.identity.api import router as identity_router
from app.modules.rbac.api import router as rbac_router
from app.modules.tenancy.api import router as tenancy_router


def include_routers(app: FastAPI) -> None:
    # Health first
    app.include_router(health_router)

    # Foundation modules
    app.include_router(identity_router)
    app.include_router(tenancy_router)
    app.include_router(rbac_router)
    app.include_router(audit_router)
    app.include_router(dms_router)

