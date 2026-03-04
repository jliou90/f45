from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.modules.identity.models import User
from app.modules.rbac.service import ensure_default_admin_role
from app.modules.tenancy.models import Tenant
from app.modules.tenancy import service as tenancy_service


def main() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(dotenv_path=Path(__file__).resolve().with_name(".env"), override=False)
    except ImportError:
        # Container runtime relies on env vars passed by compose.
        pass

    db = SessionLocal()
    try:
        tenant_name = (os.getenv("KUTM_SEED_TENANT") or "Default").strip()
        email = (os.getenv("KUTM_SEED_EMAIL") or os.getenv("KUTM_EMAIL") or "you@example.com").strip().lower()
        password = os.getenv("KUTM_SEED_PASSWORD") or os.getenv("KUTM_PASSWORD") or "Password123!"
        force_password = (os.getenv("KUTM_SEED_FORCE_PASSWORD") or "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

        tenant = db.query(Tenant).filter(Tenant.name == tenant_name).one_or_none()
        if not tenant:
            tenant = Tenant(id=str(uuid4()), name=tenant_name)
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"Created tenant: {tenant.name} (id={tenant.id})")
        else:
            print(f"Tenant already exists: {tenant.name} (id={tenant.id})")

        user = db.query(User).filter(User.email == email).one_or_none()
        if not user:
            user = User(
                id=str(uuid4()),
                email=email,
                display_name="Seed Admin",
                password_hash=hash_password(password),
                is_active=True,
                is_disabled=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created seed user: {email} (id={user.id})")
        else:
            if force_password:
                user.password_hash = hash_password(password)
                db.add(user)
                db.commit()
                print(f"Updated seed user password hash: {email} (id={user.id})")
            else:
                print(f"Seed user already exists: {email} (id={user.id})")

        user.is_active = True
        user.is_disabled = False
        db.add(user)
        db.commit()

        admin_role = ensure_default_admin_role(db, tenant_id=tenant.id)
        m = tenancy_service.upsert_membership(
            db,
            tenant_id=tenant.id,
            user_id=user.id,
            role="ADMIN",
            role_id=admin_role.id,
        )
        print(f"Ensured membership: tenant_id={m.tenant_id} user_id={m.user_id} role={m.role}")

    finally:
        db.close()


if __name__ == "__main__":
    main()

