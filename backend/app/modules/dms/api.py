from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.pagination import PageResult
from app.core.paging import paginate_items, paginate_query
from app.core.querying import Page, Sort, apply_sort, page_params, sort_params
from app.core.rbac import Permission, require_permission
from app.core.request_id import get_request_id
from app.core.tenancy.deps import get_current_tenant
from app.core.tenancy.query import tenant_scoped_query
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.audit.service import log_audit_event
from app.modules.dms.appointments_rules import check_vehicle_overlap, default_end, validate_times
from app.modules.dms.models import Appointment, Customer, CustomerCrmProfile, Vehicle
from app.modules.dms.schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentPatch,
    AppointmentUpdate,
    CustomerCrmProfileOut,
    CustomerCrmProfileUpsert,
    CustomerCreate,
    CustomerOut,
    CustomerSummaryOut,
    CustomerPatch,
    CustomerUpdate,
    VehicleCreate,
    VehicleOut,
    VehiclePatch,
    VehicleUpdate,
)
from app.modules.eventstore.service import append_event
from app.modules.identity.models import User
from app.modules.integrations.service import enqueue_outbox
from app.modules.tenancy.models import Membership
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends, Header, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session

# Module router owns prefix for now (composition root currently supports this style).
router = APIRouter(
    prefix="/dms",
    tags=["dms"],
    dependencies=[Depends(get_current_tenant), Depends(require_permission(Permission.DMS_READ))],
)

def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# Strict optimistic concurrency by default for all DMS edits.
REQUIRE_IF_MATCH = _env_bool("KUTM_DMS_REQUIRE_IF_MATCH", True)


# ---------------- errors & helpers ----------------

def _not_found(entity: str) -> AppError:
    return AppError(
        code=f"{entity.lower()}_not_found",
        message=f"{entity} not found",
        status_code=404,
    )


def _bad_request(code: str, msg: str, details: Any | None = None) -> AppError:
    return AppError(code=code, message=msg, status_code=400, details=details)


def _conflict(code: str, msg: str, details: Any | None = None) -> AppError:
    return AppError(code=code, message=msg, status_code=409, details=details)


def _safe_model_dump(payload, *, exclude_unset: bool = False) -> dict:
    # Pydantic v2
    return payload.model_dump(exclude_unset=exclude_unset)


def _etag_for_version(version: int) -> str:
    # Strong ETag on integer version. Quoted per RFC.
    return f"\"{version}\""


def _parse_if_match(if_match: str | None) -> int | None:
    if not if_match:
        return None
    s = if_match.strip()
    if s == "*" or s == "\"*\"":
        return None
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    try:
        return int(s)
    except ValueError:
        return None


def _require_match_or_allow(entity_name: str, current_version: int, if_match: str | None) -> None:
    """
    Optimistic concurrency control.
    - If REQUIRE_IF_MATCH=False, accept missing If-Match but still enforce mismatch if provided.
    - If REQUIRE_IF_MATCH=True, missing If-Match becomes a conflict.
    """
    sent = _parse_if_match(if_match)

    if sent is None:
        if REQUIRE_IF_MATCH and if_match is None:
            raise _conflict(
                "if_match_required",
                f"If-Match required for {entity_name} updates (send current version).",
                details={"entity": entity_name, "current_version": current_version},
            )
        return

    if sent != current_version:
        raise _conflict(
            "version_mismatch",
            f"{entity_name} version mismatch. Refresh and retry.",
            details={"entity": entity_name, "current_version": current_version, "if_match": sent},
        )


def _bump_version(obj: Any) -> None:
    if hasattr(obj, "version") and isinstance(obj.version, int):
        obj.version = obj.version + 1


def _soft_delete(obj: Any) -> None:
    if hasattr(obj, "is_deleted"):
        obj.is_deleted = True
    if hasattr(obj, "deleted_at"):
        obj.deleted_at = datetime.now().astimezone()
    _bump_version(obj)


def _not_deleted_filter(model):
    if hasattr(model, "is_deleted"):
        return model.is_deleted.is_(False)
    return True


def _apply_customer_search(qry, q: str | None):
    if not q or not q.strip():
        return qry
    like = f"%{q.strip()}%"
    return qry.filter(
        (Customer.first_name.ilike(like))
        | (Customer.last_name.ilike(like))
        | (Customer.phone.ilike(like))
        | (Customer.email.ilike(like))
    )


def _string(v: object | None) -> str:
    if isinstance(v, str):
        return v
    return ""


def _array(v: object | None) -> list[dict[str, object]]:
    if not isinstance(v, list):
        return []
    return [x for x in v if isinstance(x, dict)]


def _primary_contact(items: list[dict[str, object]], *, value_key: str) -> str:
    for item in items:
        if bool(item.get("primary")):
            return _string(item.get(value_key))
    if items:
        return _string(items[0].get(value_key))
    return ""


def _latest_communication_at(communications: list[dict[str, object]]) -> str:
    times = [_string(item.get("happened_at")) for item in communications]
    nonempty = [x for x in times if x]
    return max(nonempty) if nonempty else ""


def _customer_summary_out(customer: Customer, crm: CustomerCrmProfile | None) -> CustomerSummaryOut:
    phones = _array(getattr(crm, "phones", None))
    emails = _array(getattr(crm, "emails", None))
    garage = _array(getattr(crm, "garage", None))
    notes = _array(getattr(crm, "notes", None))
    communications = _array(getattr(crm, "communications", None))
    return CustomerSummaryOut(
        id=customer.id,
        dms_customer_id=_string(getattr(crm, "dms_customer_id", None)),
        name=f"{customer.first_name} {customer.last_name}".strip(),
        primary_phone=_primary_contact(phones, value_key="number") or _string(customer.phone),
        primary_email=_primary_contact(emails, value_key="email") or _string(customer.email),
        household_id=_string(getattr(crm, "household_id", None)),
        garage_count=len(garage),
        notes_count=len(notes),
        last_communication_at=_latest_communication_at(communications),
    )


def _apply_vehicle_search(qry, q: str | None):
    if not q or not q.strip():
        return qry
    like = f"%{q.strip()}%"
    clauses = [
        Vehicle.vin.ilike(like),
        Vehicle.make.ilike(like),
        Vehicle.model.ilike(like),
    ]
    if hasattr(Vehicle, "trim"):
        clauses.append(Vehicle.trim.ilike(like))

    expr = clauses[0]
    for c in clauses[1:]:
        expr = expr | c
    return qry.filter(expr)


def _get_customer(db: Session, tenant_id: str, customer_id: str) -> Customer:
    c = (
        tenant_scoped_query(db, Customer, tenant_id=tenant_id)
        .filter(
            Customer.id == customer_id,
            _not_deleted_filter(Customer),
        )
        .one_or_none()
    )
    if not c:
        raise _not_found("Customer")
    return c


def _get_vehicle(db: Session, tenant_id: str, vehicle_id: str) -> Vehicle:
    v = (
        tenant_scoped_query(db, Vehicle, tenant_id=tenant_id)
        .filter(
            Vehicle.id == vehicle_id,
            _not_deleted_filter(Vehicle),
        )
        .one_or_none()
    )
    if not v:
        raise _not_found("Vehicle")
    return v


def _get_customer_crm_profile(db: Session, tenant_id: str, customer_id: str) -> CustomerCrmProfile | None:
    return (
        tenant_scoped_query(db, CustomerCrmProfile, tenant_id=tenant_id)
        .filter(CustomerCrmProfile.customer_id == customer_id)
        .one_or_none()
    )


def _crm_payload_from_model(row: CustomerCrmProfile) -> CustomerCrmProfileOut:
    return CustomerCrmProfileOut(
        id=row.id,
        tenant_id=row.tenant_id,
        customer_id=row.customer_id,
        version=row.version,
        dms_customer_id=row.dms_customer_id or "",
        spouse={
            "first_name": row.spouse_first_name or "",
            "last_name": row.spouse_last_name or "",
            "phone": row.spouse_phone or "",
            "email": row.spouse_email or "",
            "notes": row.spouse_notes or "",
        },
        household={
            "household_id": row.household_id or "",
            "relationship": row.household_relationship or "",
            "linked_customer_ids": row.linked_customer_ids or [],
        },
        phones=row.phones or [],
        emails=row.emails or [],
        garage=row.garage or [],
        notes=row.notes or [],
        communications=row.communications or [],
        tasks=row.tasks or [],
        attachments=row.attachments or [],
    )


def _get_appointment(db: Session, tenant_id: str, appointment_id: str) -> Appointment:
    a = (
        tenant_scoped_query(db, Appointment, tenant_id=tenant_id)
        .filter(
            Appointment.id == appointment_id,
            _not_deleted_filter(Appointment),
        )
        .one_or_none()
    )
    if not a:
        raise _not_found("Appointment")
    return a


def _set_etag(response: Response, version: int) -> None:
    response.headers["ETag"] = _etag_for_version(version)


def _ensure_version(obj: Any) -> int:
    version = getattr(obj, "version", None) or 1
    obj.version = version
    return version


def _queue_schedule_change_notifications(
    *,
    db: Session,
    tenant_id: str,
    appointment_id: str,
    old_start: datetime | None,
    old_end: datetime | None,
    new_start: datetime | None,
    new_end: datetime | None,
    technician_user_id: str | None,
    advisor_user_id: str | None,
) -> None:
    if old_start == new_start and old_end == new_end:
        return
    payload = {
        "appointment_id": appointment_id,
        "old_start": old_start.isoformat() if old_start else None,
        "old_end": old_end.isoformat() if old_end else None,
        "new_start": new_start.isoformat() if new_start else None,
        "new_end": new_end.isoformat() if new_end else None,
    }
    if technician_user_id:
        enqueue_outbox(
            db=db,
            tenant_id=tenant_id,
            topic="appointments.technician.schedule_changed",
            payload={**payload, "user_id": technician_user_id},
        )
    if advisor_user_id:
        enqueue_outbox(
            db=db,
            tenant_id=tenant_id,
            topic="appointments.service_advisor.schedule_changed",
            payload={**payload, "user_id": advisor_user_id},
        )


class CommsApprovalIn(BaseModel):
    decision: str = Field(min_length=3, max_length=20)
    at: str | None = None


class CommsApprovalOut(BaseModel):
    queued: bool
    request_id: str


class TechnicianAvailabilityOut(BaseModel):
    user_id: str
    email: str
    busy: list[dict[str, str | None]]


# ---------------- Customers ----------------

@router.post("/customers", response_model=CustomerOut)
def create_customer(
    request: Request,
    response: Response,
    payload: CustomerCreate,
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CustomerOut:
    with uow as db:
        customer = Customer(id=str(uuid4()), tenant_id=tenant_id, **_safe_model_dump(payload))
        db.add(customer)
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=getattr(user, "id", None),
            action="dms.customer.create",
            entity_type="customer",
            entity_id=customer.id,
            after={
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "email": customer.email,
            },
        )
        db.flush()
        _set_etag(response, _ensure_version(customer))
        return CustomerOut.model_validate(customer, from_attributes=True)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: str,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> CustomerOut:
    c = _get_customer(db, tenant_id, customer_id)
    _set_etag(response, _ensure_version(c))
    return CustomerOut.model_validate(c, from_attributes=True)


@router.get("/customers", response_model=PageResult[CustomerOut])
def list_customers(
    q: str | None = Query(default=None, description="Search by first/last/phone/email"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[CustomerOut]:
    qry = tenant_scoped_query(db, Customer, tenant_id=tenant_id).filter(_not_deleted_filter(Customer))
    qry = _apply_customer_search(qry, q)

    if sort.fields:
        qry = apply_sort(
            qry,
            Customer,
            sort,
            allowed={"first_name", "last_name", "phone", "email", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(Customer.last_name.asc(), Customer.first_name.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda r: CustomerOut.model_validate(r, from_attributes=True),
    )


@router.get("/customers/search", response_model=PageResult[CustomerSummaryOut])
def search_customers(
    q: str | None = Query(default=None, description="Search by customer + CRM fields"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[CustomerSummaryOut]:
    join_condition = and_(
        CustomerCrmProfile.customer_id == Customer.id,
        CustomerCrmProfile.tenant_id == tenant_id,
    )
    qry = (
        db.query(Customer, CustomerCrmProfile)
        .select_from(Customer)
        .outerjoin(CustomerCrmProfile, join_condition)
        .filter(
            Customer.tenant_id == tenant_id,
            _not_deleted_filter(Customer),
        )
    )

    if q and q.strip():
        like = f"%{q.strip()}%"
        qry = qry.filter(
            (Customer.first_name.ilike(like))
            | (Customer.last_name.ilike(like))
            | (Customer.phone.ilike(like))
            | (Customer.email.ilike(like))
            | (CustomerCrmProfile.dms_customer_id.ilike(like))
            | (CustomerCrmProfile.household_id.ilike(like))
            | (CustomerCrmProfile.household_relationship.ilike(like))
            | (CustomerCrmProfile.spouse_first_name.ilike(like))
            | (CustomerCrmProfile.spouse_last_name.ilike(like))
            | (CustomerCrmProfile.spouse_phone.ilike(like))
            | (CustomerCrmProfile.spouse_email.ilike(like))
        )

    if sort.fields:
        qry = apply_sort(
            qry,
            Customer,
            sort,
            allowed={"first_name", "last_name", "phone", "email", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(Customer.last_name.asc(), Customer.first_name.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda row: _customer_summary_out(row[0], row[1]),
    )


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    request: Request,
    response: Response,
    customer_id: str,
    payload: CustomerUpdate,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CustomerOut:
    with uow as db:
        c = _get_customer(db, tenant_id, customer_id)
        _require_match_or_allow("Customer", getattr(c, "version", 1), if_match)
        before = {
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "email": c.email,
            "address1": c.address1,
            "address2": c.address2,
            "city": c.city,
            "state": c.state,
            "zip": c.zip,
        }

        data = _safe_model_dump(payload)
        for k, v in data.items():
            setattr(c, k, v)
        _bump_version(c)
        after = {
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "email": c.email,
            "address1": c.address1,
            "address2": c.address2,
            "city": c.city,
            "state": c.state,
            "zip": c.zip,
        }
        changed = sorted([k for k in after.keys() if before.get(k) != after.get(k)])
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=getattr(_user, "id", None),
            action="dms.customer.update",
            entity_type="customer",
            entity_id=c.id,
            metadata={"changed_fields": changed},
            before=before,
            after=after,
        )

        db.flush()
        _set_etag(response, _ensure_version(c))
        return CustomerOut.model_validate(c, from_attributes=True)


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def patch_customer(
    request: Request,
    response: Response,
    customer_id: str,
    payload: CustomerPatch,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CustomerOut:
    with uow as db:
        c = _get_customer(db, tenant_id, customer_id)
        _require_match_or_allow("Customer", getattr(c, "version", 1), if_match)

        data = _safe_model_dump(payload, exclude_unset=True)
        if not data:
            raise _bad_request("no_fields", "No fields provided")

        for k, v in data.items():
            setattr(c, k, v)
        _bump_version(c)

        db.flush()
        _set_etag(response, _ensure_version(c))
        return CustomerOut.model_validate(c, from_attributes=True)


@router.delete("/customers/{customer_id}", response_model=CustomerOut)
def delete_customer(
    request: Request,
    response: Response,
    customer_id: str,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CustomerOut:
    with uow as db:
        c = _get_customer(db, tenant_id, customer_id)
        _require_match_or_allow("Customer", getattr(c, "version", 1), if_match)

        _soft_delete(c)
        db.flush()
        _set_etag(response, _ensure_version(c))
        return CustomerOut.model_validate(c, from_attributes=True)


# ---------------- Customer CRM profiles ----------------

@router.get("/customers-crm", response_model=PageResult[CustomerCrmProfileOut])
def list_customer_crm_profiles(
    customer_id: str | None = Query(default=None, description="Optional filter by customer_id"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[CustomerCrmProfileOut]:
    qry = tenant_scoped_query(db, CustomerCrmProfile, tenant_id=tenant_id)
    if customer_id:
        qry = qry.filter(CustomerCrmProfile.customer_id == customer_id)

    if sort.fields:
        qry = apply_sort(
            qry,
            CustomerCrmProfile,
            sort,
            allowed={"customer_id", "dms_customer_id", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(CustomerCrmProfile.updated_at.desc())

    return paginate_query(
        qry,
        page=page,
        item_map=_crm_payload_from_model,
    )


@router.get("/customers/{customer_id}/crm", response_model=CustomerCrmProfileOut)
def get_customer_crm_profile(
    customer_id: str,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> CustomerCrmProfileOut:
    _get_customer(db, tenant_id, customer_id)
    profile = _get_customer_crm_profile(db, tenant_id, customer_id)
    if not profile:
        raise _not_found("Customer CRM profile")
    _set_etag(response, _ensure_version(profile))
    return _crm_payload_from_model(profile)


@router.put("/customers/{customer_id}/crm", response_model=CustomerCrmProfileOut)
def upsert_customer_crm_profile(
    request: Request,
    response: Response,
    customer_id: str,
    payload: CustomerCrmProfileUpsert,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CustomerCrmProfileOut:
    with uow as db:
        _get_customer(db, tenant_id, customer_id)
        existing = _get_customer_crm_profile(db, tenant_id, customer_id)
        before = _crm_payload_from_model(existing).model_dump(mode="json") if existing else None

        if existing is None:
            profile = CustomerCrmProfile(
                id=str(uuid4()),
                tenant_id=tenant_id,
                customer_id=customer_id,
            )
            db.add(profile)
            db.flush()
        else:
            profile = existing
            _require_match_or_allow("Customer CRM profile", getattr(profile, "version", 1), if_match)
            _bump_version(profile)

        profile.dms_customer_id = payload.dms_customer_id or None
        profile.spouse_first_name = payload.spouse.first_name or None
        profile.spouse_last_name = payload.spouse.last_name or None
        profile.spouse_phone = payload.spouse.phone or None
        profile.spouse_email = payload.spouse.email or None
        profile.spouse_notes = payload.spouse.notes or None
        profile.household_id = payload.household.household_id or None
        profile.household_relationship = payload.household.relationship or None
        profile.linked_customer_ids = payload.household.linked_customer_ids
        profile.phones = [x.model_dump(mode="json") for x in payload.phones]
        profile.emails = [x.model_dump(mode="json") for x in payload.emails]
        profile.garage = [x.model_dump(mode="json") for x in payload.garage]
        profile.notes = [x.model_dump(mode="json") for x in payload.notes]
        profile.communications = [x.model_dump(mode="json") for x in payload.communications]
        profile.tasks = [x.model_dump(mode="json") for x in payload.tasks]
        profile.attachments = [x.model_dump(mode="json") for x in payload.attachments]

        db.flush()
        after = _crm_payload_from_model(profile).model_dump(mode="json")
        changed = sorted([k for k in after.keys() if k in {"dms_customer_id", "spouse", "household", "phones", "emails", "garage", "notes", "communications", "tasks", "attachments"} and (before or {}).get(k) != after.get(k)])
        log_audit_event(
            db=db,
            tenant_id=tenant_id,
            actor_id=getattr(_user, "id", None),
            action="dms.customer.crm.upsert",
            entity_type="customer",
            entity_id=customer_id,
            metadata={"changed_sections": changed},
            before=before,
            after=after,
        )
        _set_etag(response, _ensure_version(profile))
        return _crm_payload_from_model(profile)


# ---------------- Vehicles (Garage) ----------------

@router.post("/vehicles", response_model=VehicleOut)
def create_vehicle(
    request: Request,
    response: Response,
    payload: VehicleCreate,
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> VehicleOut:
    with uow as db:
        customer_id = getattr(payload, "customer_id", None)
        if customer_id:
            _get_customer(db, tenant_id, customer_id)

        v = Vehicle(id=str(uuid4()), tenant_id=tenant_id, **_safe_model_dump(payload))
        db.add(v)
        db.flush()
        _set_etag(response, _ensure_version(v))
        return VehicleOut.model_validate(v, from_attributes=True)


@router.get("/vehicles", response_model=PageResult[VehicleOut])
def list_vehicles(
    customer_id: str | None = Query(default=None, description="Filter by owning customer"),
    q: str | None = Query(default=None, description="Search VIN/make/model/(trim if present)"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[VehicleOut]:
    qry = tenant_scoped_query(db, Vehicle, tenant_id=tenant_id).filter(_not_deleted_filter(Vehicle))

    if customer_id:
        qry = qry.filter(Vehicle.customer_id == customer_id)

    qry = _apply_vehicle_search(qry, q)

    if sort.fields:
        qry = apply_sort(
            qry,
            Vehicle,
            sort,
            allowed={"vin", "year", "make", "model", "trim", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(Vehicle.vin.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda r: VehicleOut.model_validate(r, from_attributes=True),
    )


@router.get("/customers/{customer_id}/vehicles", response_model=PageResult[VehicleOut])
def list_customer_vehicles(
    customer_id: str,
    q: str | None = Query(
        default=None,
        description="Search VIN/make/model/(trim if present) within this customer",
    ),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[VehicleOut]:
    _get_customer(db, tenant_id, customer_id)

    qry = tenant_scoped_query(db, Vehicle, tenant_id=tenant_id).filter(
        Vehicle.customer_id == customer_id,
        _not_deleted_filter(Vehicle),
    )
    qry = _apply_vehicle_search(qry, q)

    if sort.fields:
        qry = apply_sort(
            qry,
            Vehicle,
            sort,
            allowed={"vin", "year", "make", "model", "trim", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(Vehicle.vin.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda r: VehicleOut.model_validate(r, from_attributes=True),
    )


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: str,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> VehicleOut:
    v = _get_vehicle(db, tenant_id, vehicle_id)
    _set_etag(response, _ensure_version(v))
    return VehicleOut.model_validate(v, from_attributes=True)


@router.put("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    request: Request,
    response: Response,
    vehicle_id: str,
    payload: VehicleUpdate,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> VehicleOut:
    with uow as db:
        v = _get_vehicle(db, tenant_id, vehicle_id)
        _require_match_or_allow("Vehicle", getattr(v, "version", 1), if_match)

        customer_id = getattr(payload, "customer_id", None)
        if customer_id:
            _get_customer(db, tenant_id, customer_id)

        data = _safe_model_dump(payload)
        for k, val in data.items():
            setattr(v, k, val)
        _bump_version(v)

        db.flush()
        _set_etag(response, _ensure_version(v))
        return VehicleOut.model_validate(v, from_attributes=True)


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleOut)
def patch_vehicle(
    request: Request,
    response: Response,
    vehicle_id: str,
    payload: VehiclePatch,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> VehicleOut:
    with uow as db:
        v = _get_vehicle(db, tenant_id, vehicle_id)
        _require_match_or_allow("Vehicle", getattr(v, "version", 1), if_match)

        data = _safe_model_dump(payload, exclude_unset=True)
        if not data:
            raise _bad_request("no_fields", "No fields provided")

        if "customer_id" in data and data["customer_id"]:
            _get_customer(db, tenant_id, data["customer_id"])

        for k, val in data.items():
            setattr(v, k, val)
        _bump_version(v)

        db.flush()
        _set_etag(response, _ensure_version(v))
        return VehicleOut.model_validate(v, from_attributes=True)


@router.delete("/vehicles/{vehicle_id}", response_model=VehicleOut)
def delete_vehicle(
    request: Request,
    response: Response,
    vehicle_id: str,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> VehicleOut:
    with uow as db:
        v = _get_vehicle(db, tenant_id, vehicle_id)
        _require_match_or_allow("Vehicle", getattr(v, "version", 1), if_match)

        _soft_delete(v)
        db.flush()
        _set_etag(response, _ensure_version(v))
        return VehicleOut.model_validate(v, from_attributes=True)


@router.get("/vehicles/by-vin/{vin}", response_model=VehicleOut)
def get_vehicle_by_vin(
    vin: str,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> VehicleOut:
    v = tenant_scoped_query(db, Vehicle, tenant_id=tenant_id).filter(
        Vehicle.vin == vin,
        _not_deleted_filter(Vehicle),
    ).one_or_none()
    if not v:
        raise _not_found("Vehicle")
    _set_etag(response, _ensure_version(v))
    return VehicleOut.model_validate(v, from_attributes=True)


# ---------------- Comms ----------------

@router.post("/comms/{conversation_id}/approval", response_model=CommsApprovalOut)
def post_comms_approval(
    request: Request,
    conversation_id: str,
    payload: CommsApprovalIn,
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> CommsApprovalOut:
    decision = payload.decision.strip().lower()
    if decision not in {"request", "approve", "reject"}:
        raise _bad_request(
            "decision_invalid",
            "decision must be one of: request, approve, reject",
        )
    with uow as db:
        append_event(
            db=db,
            tenant_id=tenant_id,
            stream_type="comms",
            stream_id=conversation_id,
            event_type=f"comms.{decision}",
            payload={"decision": decision, "at": payload.at},
            correlation_id=get_request_id(),
        )
        request_id = get_request_id() or "unknown"
        return CommsApprovalOut(queued=False, request_id=request_id)


# ---------------- Appointments ----------------

@router.get("/availability/technicians", response_model=PageResult[TechnicianAvailabilityOut])
def technician_availability(
    day: date = Query(..., description="YYYY-MM-DD"),
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_SCHEDULER_READ)),
) -> PageResult[TechnicianAvailabilityOut]:
    start = datetime.combine(day, datetime.min.time()).astimezone()
    end = start + timedelta(days=1)
    tech_rows = (
        db.query(User.id, User.email)
        .join(Membership, Membership.user_id == User.id)
        .filter(
            Membership.tenant_id == tenant_id,
            User.is_active.is_(True),
            User.is_disabled.is_(False),
        )
        .order_by(User.email.asc())
        .all()
    )
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant_id,
            Appointment.is_deleted.is_(False),
            Appointment.scheduled_start >= start,
            Appointment.scheduled_start < end,
            Appointment.technician_user_id.is_not(None),
        )
        .order_by(Appointment.scheduled_start.asc())
        .all()
    )
    busy_map: dict[str, list[dict[str, str | None]]] = {}
    for a in appts:
        tech_id = a.technician_user_id
        if not tech_id:
            continue
        busy_map.setdefault(tech_id, []).append(
            {
                "appointment_id": a.id,
                "start": a.scheduled_start.isoformat() if a.scheduled_start else None,
                "end": a.scheduled_end.isoformat() if a.scheduled_end else None,
            }
        )
    items = [TechnicianAvailabilityOut(user_id=row.id, email=row.email, busy=busy_map.get(row.id, [])) for row in tech_rows]
    return paginate_items(items, page=page, item_map=lambda x: x)


@router.post("/appointments", response_model=AppointmentOut)
def create_appointment(
    request: Request,
    response: Response,
    payload: AppointmentCreate,
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> AppointmentOut:
    with uow as db:
        _get_customer(db, tenant_id, payload.customer_id)

        if payload.vehicle_id:
            _get_vehicle(db, tenant_id, payload.vehicle_id)

        start = payload.scheduled_start
        end = default_end(start, payload.scheduled_end)
        validate_times(start, end)
        check_vehicle_overlap(db, tenant_id, payload.vehicle_id, start, end)

        data = _safe_model_dump(payload)
        data["scheduled_end"] = end

        appt = Appointment(id=str(uuid4()), tenant_id=tenant_id, **data)
        db.add(appt)
        db.flush()
        _queue_schedule_change_notifications(
            db=db,
            tenant_id=tenant_id,
            appointment_id=appt.id,
            old_start=None,
            old_end=None,
            new_start=appt.scheduled_start,
            new_end=appt.scheduled_end,
            technician_user_id=appt.technician_user_id,
            advisor_user_id=appt.service_advisor_user_id,
        )
        _set_etag(response, _ensure_version(appt))
        return AppointmentOut.model_validate(appt, from_attributes=True)


@router.put("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    request: Request,
    response: Response,
    appointment_id: str,
    payload: AppointmentUpdate,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> AppointmentOut:
    with uow as db:
        appt = _get_appointment(db, tenant_id, appointment_id)
        _require_match_or_allow("Appointment", getattr(appt, "version", 1), if_match)
        old_start = appt.scheduled_start
        old_end = appt.scheduled_end

        start = payload.scheduled_start
        end = default_end(start, payload.scheduled_end)
        validate_times(start, end)

        new_vehicle_id = getattr(payload, "vehicle_id", None) or appt.vehicle_id
        check_vehicle_overlap(db, tenant_id, new_vehicle_id, start, end, exclude_id=appointment_id)

        data = _safe_model_dump(payload)
        data["scheduled_end"] = end
        for k, v in data.items():
            setattr(appt, k, v)
        _bump_version(appt)

        db.flush()
        _queue_schedule_change_notifications(
            db=db,
            tenant_id=tenant_id,
            appointment_id=appt.id,
            old_start=old_start,
            old_end=old_end,
            new_start=appt.scheduled_start,
            new_end=appt.scheduled_end,
            technician_user_id=appt.technician_user_id,
            advisor_user_id=appt.service_advisor_user_id,
        )
        _set_etag(response, _ensure_version(appt))
        return AppointmentOut.model_validate(appt, from_attributes=True)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def patch_appointment(
    request: Request,
    response: Response,
    appointment_id: str,
    payload: AppointmentPatch,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> AppointmentOut:
    with uow as db:
        appt = _get_appointment(db, tenant_id, appointment_id)
        _require_match_or_allow("Appointment", getattr(appt, "version", 1), if_match)
        old_start = appt.scheduled_start
        old_end = appt.scheduled_end

        start = getattr(payload, "scheduled_start", None) or appt.scheduled_start
        end_in = getattr(payload, "scheduled_end", None) or appt.scheduled_end
        end = default_end(start, end_in)
        validate_times(start, end)

        new_vehicle_id = getattr(payload, "vehicle_id", None) or appt.vehicle_id
        check_vehicle_overlap(db, tenant_id, new_vehicle_id, start, end, exclude_id=appointment_id)

        data = _safe_model_dump(payload, exclude_unset=True)
        if not data:
            raise _bad_request("no_fields", "No fields provided")

        data["scheduled_end"] = end
        for k, v in data.items():
            setattr(appt, k, v)
        _bump_version(appt)

        db.flush()
        _queue_schedule_change_notifications(
            db=db,
            tenant_id=tenant_id,
            appointment_id=appt.id,
            old_start=old_start,
            old_end=old_end,
            new_start=appt.scheduled_start,
            new_end=appt.scheduled_end,
            technician_user_id=appt.technician_user_id,
            advisor_user_id=appt.service_advisor_user_id,
        )
        _set_etag(response, _ensure_version(appt))
        return AppointmentOut.model_validate(appt, from_attributes=True)


@router.delete("/appointments/{appointment_id}", response_model=AppointmentOut)
def delete_appointment(
    request: Request,
    response: Response,
    appointment_id: str,
    if_match: str | None = Header(default=None, alias="If-Match"),
    _idmp=Depends(idempotency_guard),
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
    _perm=Depends(require_permission(Permission.DMS_WRITE)),
) -> AppointmentOut:
    with uow as db:
        appt = _get_appointment(db, tenant_id, appointment_id)
        _require_match_or_allow("Appointment", getattr(appt, "version", 1), if_match)

        _soft_delete(appt)
        db.flush()
        _set_etag(response, _ensure_version(appt))
        return AppointmentOut.model_validate(appt, from_attributes=True)


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: str,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> AppointmentOut:
    a = _get_appointment(db, tenant_id, appointment_id)
    _set_etag(response, _ensure_version(a))
    return AppointmentOut.model_validate(a, from_attributes=True)


@router.get("/appointments", response_model=PageResult[AppointmentOut])
def list_appointments(
    day: date | None = Query(
        default=None,
        description="YYYY-MM-DD (filters scheduled_start for that day)",
    ),
    customer_id: str | None = Query(default=None, description="Optional filter by customer"),
    vehicle_id: str | None = Query(default=None, description="Optional filter by vehicle"),
    q: str | None = Query(default=None, description="Optional search by status/notes"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
) -> PageResult[AppointmentOut]:
    qry = tenant_scoped_query(db, Appointment, tenant_id=tenant_id).filter(
        _not_deleted_filter(Appointment),
    )

    if customer_id:
        qry = qry.filter(Appointment.customer_id == customer_id)

    if vehicle_id:
        qry = qry.filter(Appointment.vehicle_id == vehicle_id)

    if day:
        start = datetime.combine(day, datetime.min.time()).astimezone()
        end = start + timedelta(days=1)
        qry = qry.filter(Appointment.scheduled_start >= start, Appointment.scheduled_start < end)

    if q and q.strip():
        like = f"%{q.strip()}%"
        qry = qry.filter((Appointment.status.ilike(like)) | (Appointment.notes.ilike(like)))

    if sort.fields:
        qry = apply_sort(
            qry,
            Appointment,
            sort,
            allowed={"scheduled_start", "scheduled_end", "status", "created_at", "updated_at"},
        )
    else:
        qry = qry.order_by(Appointment.scheduled_start.asc())

    return paginate_query(
        qry,
        page=page,
        item_map=lambda r: AppointmentOut.model_validate(r, from_attributes=True),
    )

