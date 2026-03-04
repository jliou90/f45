from __future__ import annotations

from app.modules.rbac.models import PermissionGrant
from app.modules.rbac.service import seed_permission_catalog
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


def test_maturity_permissions_seeded() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    PermissionGrant.__table__.create(bind=engine)
    with Session(engine) as db:
        seed_permission_catalog(db)
        db.commit()
        keys = {row[0] for row in db.query(PermissionGrant.key).all()}
    engine.dispose()
    assert "dms.scheduler.read" in keys
    assert "comms.customer.read" in keys
    assert "comms.customer.write" in keys
    assert "comms.funding.write" in keys
    assert "inventory.supplies.read" in keys
    assert "inventory.supplies.write" in keys
    assert "inventory.procurement.read" in keys
    assert "inventory.procurement.write" in keys
