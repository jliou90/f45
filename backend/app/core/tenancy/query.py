from __future__ import annotations

from app.core.errors import AppError
from sqlalchemy.orm import Query, Session


def tenant_scoped_query(db: Session, model, *, tenant_id: str) -> Query:
    if not tenant_id:
        raise AppError(code="tenant_missing", message="Missing tenant_id for tenant-scoped query", status_code=400)
    if not hasattr(model, "tenant_id"):
        raise AppError(code="tenant_scope_invalid_model", message=f"{model.__name__} is not tenant-scoped", status_code=500)
    return db.query(model).filter(model.tenant_id == tenant_id)
