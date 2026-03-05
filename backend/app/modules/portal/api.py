from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.core.rbac import Permission, require_any_permission
from app.core.tenancy.deps import get_tenant_id
from app.modules.accounting.models import AcctOpsState, AcctWorkflowRecord
from app.modules.dms.models import Customer, CustomerCrmProfile
from app.modules.portal.models import PortalUserPrefs
from app.modules.portal.schemas import (
    ActionCenterQueueItem,
    ActionCenterQueueOut,
    ActionCenterQueueSummary,
    PortalActionCenterPrefsIn,
    PortalActionCenterPrefsOut,
    PortalSavedView,
    PortalSearchFacets,
    PortalSearchItem,
    PortalSearchOut,
)
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.auth.deps import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/portal", tags=["portal"])


def _iso(dt: object) -> str:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return ""


def _parse_modules(raw: str) -> list[str]:
    modules = [x.strip().lower() for x in raw.split(",") if x.strip()]
    return modules or ["customers", "accounting"]


def _role_default_mode(role: str) -> str:
    normalized = (role or "").upper()
    if normalized == "OPS":
        return "accounting"
    if normalized == "USER":
        return "customers"
    return "hybrid"


def _effective_team_mode(
    *,
    role: str,
    prefs: PortalUserPrefs | None,
    explicit_mode: str | None,
) -> str:
    if explicit_mode and explicit_mode.strip():
        return explicit_mode.strip().lower()
    if prefs and prefs.team_queue_mode and prefs.team_queue_mode != "role_default":
        return prefs.team_queue_mode
    if prefs and isinstance(prefs.role_queue_overrides, dict):
        role_override = prefs.role_queue_overrides.get((role or "").upper())
        if isinstance(role_override, str) and role_override.strip():
            return role_override.strip().lower()
    return _role_default_mode(role)


def _prefs_row(db: Session, tenant_id: str, user_id: str) -> PortalUserPrefs | None:
    return (
        db.query(PortalUserPrefs)
        .filter(PortalUserPrefs.tenant_id == tenant_id, PortalUserPrefs.user_id == user_id)
        .one_or_none()
    )


def _prefs_out(row: PortalUserPrefs | None) -> PortalActionCenterPrefsOut:
    if row is None:
        return PortalActionCenterPrefsOut()

    saved_views: list[PortalSavedView] = []
    for item in row.saved_views_json or []:
        if isinstance(item, dict):
            saved_views.append(PortalSavedView.model_validate(item))

    return PortalActionCenterPrefsOut(
        saved_views=saved_views,
        default_view_id=row.default_view_id,
        team_queue_mode=row.team_queue_mode,
        role_queue_overrides=row.role_queue_overrides or {},
        updated_at=_iso(row.updated_at),
    )


@router.get(
    "/search",
    response_model=PortalSearchOut,
    dependencies=[Depends(require_any_permission(Permission.DMS_READ, Permission.ACCOUNTING_READ))],
)
def portal_search(
    q: str | None = Query(default=None, description="Search text for customer + accounting modules"),
    modules: str = Query(default="customers,accounting", description="Comma-separated module names"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> PortalSearchOut:
    query = (q or "").strip()
    module_list = _parse_modules(modules)
    include_customers = "customers" in module_list
    include_accounting = "accounting" in module_list

    items: list[PortalSearchItem] = []
    facets = PortalSearchFacets()

    if include_customers:
        join_condition = and_(
            CustomerCrmProfile.customer_id == Customer.id,
            CustomerCrmProfile.tenant_id == tenant_id,
        )
        customer_q = (
            db.query(Customer, CustomerCrmProfile)
            .select_from(Customer)
            .outerjoin(CustomerCrmProfile, join_condition)
            .filter(Customer.tenant_id == tenant_id, Customer.is_deleted.is_(False))
        )
        if query:
            like = f"%{query}%"
            customer_q = customer_q.filter(
                (Customer.first_name.ilike(like))
                | (Customer.last_name.ilike(like))
                | (Customer.phone.ilike(like))
                | (Customer.email.ilike(like))
                | (CustomerCrmProfile.dms_customer_id.ilike(like))
                | (CustomerCrmProfile.household_id.ilike(like))
                | (CustomerCrmProfile.spouse_first_name.ilike(like))
                | (CustomerCrmProfile.spouse_last_name.ilike(like))
            )
        facets.customers = customer_q.order_by(None).count()
        for customer, crm in customer_q.order_by(Customer.updated_at.desc()).limit(limit).all():
            full_name = f"{customer.first_name} {customer.last_name}".strip()
            subtitle = " ".join(
                [
                    x
                    for x in [
                        getattr(crm, "dms_customer_id", "") if crm else "",
                        customer.phone or "",
                        customer.email or "",
                    ]
                    if x
                ]
            )
            items.append(
                PortalSearchItem(
                    module="customers",
                    entity_id=customer.id,
                    title=full_name or customer.id,
                    subtitle=subtitle,
                    status="active",
                    updated_at=_iso(customer.updated_at),
                    url=f"/dms/customers/{customer.id}",
                )
            )

    if include_accounting:
        acct_q = db.query(AcctWorkflowRecord).filter(AcctWorkflowRecord.tenant_id == tenant_id)
        if query:
            like = f"%{query}%"
            acct_q = acct_q.filter(
                (AcctWorkflowRecord.reference_number.ilike(like))
                | (AcctWorkflowRecord.title.ilike(like))
                | (AcctWorkflowRecord.notes.ilike(like))
                | (AcctWorkflowRecord.counterparty.ilike(like))
                | (AcctWorkflowRecord.employee_id.ilike(like))
            )
        facets.accounting = acct_q.order_by(None).count()
        for row in acct_q.order_by(AcctWorkflowRecord.updated_at.desc()).limit(limit).all():
            subtitle = " ".join(
                [
                    x
                    for x in [
                        row.reference_number or "",
                        row.counterparty or "",
                        row.employee_id or "",
                    ]
                    if x
                ]
            )
            items.append(
                PortalSearchItem(
                    module="accounting",
                    entity_id=row.id,
                    title=row.title or row.reference_number or row.id,
                    subtitle=subtitle,
                    status=row.status,
                    updated_at=_iso(row.updated_at),
                    url=f"/dms/accounting/{row.id}",
                )
            )

    items.sort(key=lambda item: item.updated_at or "", reverse=True)
    return PortalSearchOut(
        query=query,
        modules=module_list,
        facets=facets,
        items=items[:limit],
    )


@router.get(
    "/prefs/action-center",
    response_model=PortalActionCenterPrefsOut,
    dependencies=[Depends(require_any_permission(Permission.DMS_READ, Permission.ACCOUNTING_READ))],
)
def get_action_center_prefs(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
) -> PortalActionCenterPrefsOut:
    row = _prefs_row(db, tenant_id, user.id)
    return _prefs_out(row)


@router.put(
    "/prefs/action-center",
    response_model=PortalActionCenterPrefsOut,
    dependencies=[Depends(require_any_permission(Permission.DMS_READ, Permission.ACCOUNTING_READ))],
)
def put_action_center_prefs(
    payload: PortalActionCenterPrefsIn,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
) -> PortalActionCenterPrefsOut:
    row = _prefs_row(db, tenant_id, user.id)
    if row is None:
        row = PortalUserPrefs(id=str(uuid4()), tenant_id=tenant_id, user_id=user.id)
        db.add(row)

    row.saved_views_json = [view.model_dump(mode="json") for view in payload.saved_views][:30]
    row.default_view_id = payload.default_view_id
    row.team_queue_mode = payload.team_queue_mode.strip().lower() if payload.team_queue_mode else "role_default"
    row.role_queue_overrides = {str(k).upper(): str(v).lower() for k, v in payload.role_queue_overrides.items()}
    db.flush()
    db.refresh(row)
    return _prefs_out(row)


@router.get(
    "/action-center/queue",
    response_model=ActionCenterQueueOut,
    dependencies=[Depends(require_any_permission(Permission.DMS_READ, Permission.ACCOUNTING_READ))],
)
def action_center_queue(
    request: Request,
    mode: str | None = Query(default=None, description="Optional queue mode override"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
) -> ActionCenterQueueOut:
    role = str(getattr(request.state, "tenant_role", "USER") or "USER").upper()
    prefs = _prefs_row(db, tenant_id, user.id)
    team_mode = _effective_team_mode(role=role, prefs=prefs, explicit_mode=mode)

    include_customer = team_mode in {"customers", "hybrid"}
    include_accounting = team_mode in {"accounting", "hybrid"}

    items: list[ActionCenterQueueItem] = []
    summary = ActionCenterQueueSummary()

    if include_customer:
        join_condition = and_(
            CustomerCrmProfile.customer_id == Customer.id,
            CustomerCrmProfile.tenant_id == tenant_id,
        )
        rows = (
            db.query(Customer, CustomerCrmProfile)
            .select_from(Customer)
            .outerjoin(CustomerCrmProfile, join_condition)
            .filter(Customer.tenant_id == tenant_id, Customer.is_deleted.is_(False))
            .order_by(Customer.updated_at.desc())
            .all()
        )
        for customer, crm in rows:
            tasks = list((crm.tasks if crm else []) or [])
            for task in tasks:
                if not isinstance(task, dict):
                    continue
                status = str(task.get("status", "open"))
                if status == "done":
                    continue
                owner = str(task.get("owner", "") or "")
                if role == "USER":
                    identity_matches = {
                        str(user.id).lower(),
                        str(getattr(user, "email", "")).lower(),
                        str(getattr(user, "display_name", "")).lower(),
                    }
                    if owner.strip() and owner.lower() not in identity_matches:
                        continue
                due_at = str(task.get("due_at", "") or "")
                priority = "normal"
                if due_at:
                    try:
                        due_ts = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
                        if due_ts < datetime.now(due_ts.tzinfo):
                            priority = "high"
                    except Exception:
                        priority = "normal"
                summary.customer_tasks += 1
                items.append(
                    ActionCenterQueueItem(
                        id=f"task:{customer.id}:{task.get('id', '')}",
                        module="customers",
                        queue="customer_tasks",
                        title=f"{customer.first_name} {customer.last_name}".strip() or customer.id,
                        detail=str(task.get("title", "Task")),
                        status=status,
                        priority=priority,
                        due_at=due_at,
                        owner=owner,
                        url=f"/dms/customers/{customer.id}/overview",
                    )
                )

    if include_accounting:
        ops = db.query(AcctOpsState).filter(AcctOpsState.tenant_id == tenant_id).one_or_none()
        state = (ops.state_json if ops and isinstance(ops.state_json, dict) else {}) or {}

        approvals = list(state.get("approvals", [])) if isinstance(state.get("approvals", []), list) else []
        for approval in approvals:
            if not isinstance(approval, dict):
                continue
            if str(approval.get("status", "")) != "pending":
                continue
            summary.accounting_approvals += 1
            items.append(
                ActionCenterQueueItem(
                    id=f"approval:{approval.get('id', '')}",
                    module="accounting",
                    queue="accounting_approvals",
                    title=str(approval.get("area", "approval")),
                    detail=str(approval.get("entityId", "")),
                    status="pending",
                    priority="high",
                    due_at="",
                    owner="",
                    url="/dms/accounting/inbox",
                )
            )

        exceptions = list(state.get("roExceptions", [])) if isinstance(state.get("roExceptions", []), list) else []
        for ex in exceptions:
            if not isinstance(ex, dict):
                continue
            if bool(ex.get("resolved", False)):
                continue
            summary.accounting_exceptions += 1
            items.append(
                ActionCenterQueueItem(
                    id=f"exception:{ex.get('id', '')}",
                    module="accounting",
                    queue="accounting_exceptions",
                    title=str(ex.get("roId", "RO Exception")),
                    detail=str(ex.get("reason", "")),
                    status="open",
                    priority="high",
                    due_at="",
                    owner="",
                    url="/dms/accounting/inbox",
                )
            )

        review_rows = (
            db.query(AcctWorkflowRecord)
            .filter(AcctWorkflowRecord.tenant_id == tenant_id, AcctWorkflowRecord.status == "in_review")
            .order_by(AcctWorkflowRecord.updated_at.desc())
            .limit(limit)
            .all()
        )
        for row in review_rows:
            summary.accounting_reviews += 1
            items.append(
                ActionCenterQueueItem(
                    id=f"review:{row.id}",
                    module="accounting",
                    queue="accounting_reviews",
                    title=row.title or row.reference_number or row.id,
                    detail=row.reference_number or row.workflow_type,
                    status=row.status,
                    priority="normal",
                    due_at="",
                    owner=row.employee_id or "",
                    url=f"/dms/accounting/{row.id}",
                )
            )

    priority_rank = {"high": 0, "normal": 1, "low": 2}
    items.sort(key=lambda item: (priority_rank.get(item.priority, 9), item.due_at or "9999", item.title.lower()))

    return ActionCenterQueueOut(
        role=role,
        team_mode=team_mode,
        summary=summary,
        items=items[:limit],
    )
