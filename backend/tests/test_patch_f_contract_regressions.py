from __future__ import annotations

from types import SimpleNamespace

from app.core.auth.deps import get_current_user
from app.core.idempotency import DEFAULT_EXEMPT_PATHS, idempotency_guard
from app.main import app, create_app
from app.modules.deals import api as deals_api
from app.modules.funding import api as funding_api
from app.modules.inventory import api as inventory_api
from app.modules.service_ro import api as service_ro_api
from app.router.api import api_router
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient


def _has_dependency(dep: Dependant, target) -> bool:
    for child in dep.dependencies:
        if child.call == target:
            return True
        if _has_dependency(child, target):
            return True
    return False


def _collect_query_params(dep: Dependant) -> set[str]:
    names = {qp.name for qp in dep.query_params}
    for child in dep.dependencies:
        names.update(_collect_query_params(child))
    return names


def test_f2_all_mutations_have_route_idempotency_guard_or_exemption() -> None:
    mutating = {"POST", "PUT", "PATCH", "DELETE"}
    exempt_paths = set(DEFAULT_EXEMPT_PATHS)
    missing: list[str] = []

    for route in api_router.routes:
        if not isinstance(route, APIRoute):
            continue
        methods = {m.upper() for m in (route.methods or set())}
        if not methods.intersection(mutating):
            continue
        if not route.path.startswith("/api/v1"):
            continue
        if route.path in exempt_paths:
            # Explicit allowlist: login, refresh, bootstrap.
            continue
        if not _has_dependency(route.dependant, idempotency_guard):
            missing.append(f"{','.join(sorted(methods.intersection(mutating)))} {route.path}")

    assert not missing, f"mutating routes missing idempotency_guard: {missing}"


def test_f3_list_routes_keep_pageresult_contract_and_query_params() -> None:
    expected_paths = {
        "/api/v1/acct/accounts",
        "/api/v1/acct/periods",
        "/api/v1/audit/events",
        "/api/v1/deals/queue/by-state",
        "/api/v1/dms/appointments",
        "/api/v1/dms/customers",
        "/api/v1/dms/customers/{customer_id}/vehicles",
        "/api/v1/dms/vehicles",
        "/api/v1/docs/attachments/{attachment_id}/links",
        "/api/v1/docs/{doc_type}",
        "/api/v1/events",
        "/api/v1/funding/queue",
        "/api/v1/integrations/webhooks",
        "/api/v1/inventory/queue",
        "/api/v1/rbac/permissions",
        "/api/v1/rbac/roles",
        "/api/v1/service/queue",
        "/api/v1/tenants/mine",
    }
    routes = [r for r in api_router.routes if isinstance(r, APIRoute)]
    for path in expected_paths:
        route = next((r for r in routes if r.path == path and "GET" in (r.methods or set())), None)
        assert route is not None, f"missing list route {path}"
        assert "PageResult" in str(route.response_model)
        query_names = _collect_query_params(route.dependant)
        assert {"page", "size", "sort"}.issubset(query_names), f"{path} missing page/size/sort params"


def test_f4_workflow_get_by_id_includes_allowed_actions(monkeypatch) -> None:
    fake_doc = SimpleNamespace(
        tenant_id="tenant-1",
        doc_type="deal_summary",
        doc_id="d-1",
        version=1,
        updated_at=None,
        document={"state": "quote"},
    )
    monkeypatch.setattr(deals_api, "get_deal_doc", lambda **_kwargs: fake_doc)
    out = deals_api.get_one("d-1", db=SimpleNamespace(), tenant_id="tenant-1")
    assert "penciled" in out.allowed_actions

    inv_doc = SimpleNamespace(
        tenant_id="tenant-1",
        doc_type="inventory_unit",
        doc_id="u-1",
        version=1,
        updated_at=None,
        document={"state": "acquired"},
    )
    monkeypatch.setattr(inventory_api, "get_inventory_doc", lambda **_kwargs: inv_doc)
    inv_out = inventory_api.get_one("u-1", db=SimpleNamespace(), tenant_id="tenant-1")
    assert "recon" in inv_out.allowed_actions

    fund_doc = SimpleNamespace(
        tenant_id="tenant-1",
        doc_type="funding_checklist",
        doc_id="f-1",
        version=1,
        updated_at=None,
        document={"status": "open"},
    )
    monkeypatch.setattr(funding_api, "get_deal_doc", lambda **_kwargs: fund_doc)
    fund_out = funding_api.get_deal("f-1", db=SimpleNamespace(), tenant_id="tenant-1")
    assert "funding.sent_to_lender" in fund_out.allowed_actions

    ro_doc = SimpleNamespace(
        tenant_id="tenant-1",
        doc_type="ro_summary",
        doc_id="r-1",
        version=1,
        updated_at=None,
        document={"status": "open"},
    )
    monkeypatch.setattr(service_ro_api, "get_ro_doc", lambda **_kwargs: ro_doc)
    ro_out = service_ro_api.get_one("r-1", db=SimpleNamespace(), tenant_id="tenant-1")
    assert "ro.authorized" in ro_out.allowed_actions


def test_f6_jobs_paths_present_in_openapi() -> None:
    spec = create_app().openapi()
    assert "/api/v1/jobs/{job_type}" in spec["paths"]
    assert "/api/v1/jobs/{job_id}" in spec["paths"]
    assert "/api/v1/docs/attachments/upload" in spec["paths"]
    assert "/api/v1/docs/attachments/{attachment_id}/download" in spec["paths"]

    attachment_props = spec["components"]["schemas"]["AttachmentOut"]["properties"]
    for field in ("id", "filename", "mime_type", "size", "sha256", "created_at", "created_by", "tenant_id"):
        assert field in attachment_props


def test_f8_tenant_header_contract_missing_and_invalid() -> None:
    client = TestClient(app)

    def _fake_user():
        return SimpleNamespace(id="user-1")

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        missing = client.get("/api/v1/tenants/current")
        assert missing.status_code == 400
        assert missing.json()["code"] == "tenant_missing"

        invalid = client.get("/api/v1/tenants/current", headers={"X-Tenant-Id": "tenant-does-not-exist"})
        assert invalid.status_code == 404
        assert invalid.json()["code"] == "tenant_not_found"
    finally:
        app.dependency_overrides.clear()
