from app.core.pagination import PageResult
from app.core.paging import paginate_items
from app.core.querying import Page, Sort, page_params, parse_sort_fields, sort_params
from app.core.rbac import Permission, require_permission
from app.modules.rbac.service import list_permissions as list_permissions_service
from app.modules.rbac.service import list_roles as list_roles_service
from app.modules.rbac.service import normalize_role_filter
from fastapi import APIRouter, Depends, Query

router = APIRouter(
    prefix="/rbac",
    tags=["rbac"],
    dependencies=[Depends(require_permission(Permission.RBAC_READ))],
)

@router.get("/roles", response_model=PageResult[str])
def list_roles(
    q: str | None = Query(default=None, description="Optional role name filter"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
):
    items = list_roles_service(q=q)
    if sort.fields:
        for _name, desc in reversed(parse_sort_fields(sort, allowed={"value", "name"})):
            items = sorted(items, reverse=desc)
    return paginate_items(items, page=page, item_map=lambda x: x)


@router.get("/permissions", response_model=PageResult[str])
def list_permissions(
    q: str | None = Query(default=None, description="Optional permission name filter"),
    role: str | None = Query(default=None, description="Optional role; limits permissions to that role"),
    page: Page = Depends(page_params),
    sort: Sort = Depends(sort_params),
):
    items = list_permissions_service(q=q, role=normalize_role_filter(role))
    if sort.fields:
        for _name, desc in reversed(parse_sort_fields(sort, allowed={"value"})):
            items = sorted(items, reverse=desc)
    return paginate_items(items, page=page, item_map=lambda x: x)
