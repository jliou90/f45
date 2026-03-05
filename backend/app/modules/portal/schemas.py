from __future__ import annotations

from pydantic import BaseModel, Field


class PortalSearchItem(BaseModel):
    module: str
    entity_id: str
    title: str
    subtitle: str
    status: str
    updated_at: str
    url: str


class PortalSearchFacets(BaseModel):
    customers: int = 0
    accounting: int = 0


class PortalSearchOut(BaseModel):
    query: str
    modules: list[str] = Field(default_factory=list)
    facets: PortalSearchFacets
    items: list[PortalSearchItem] = Field(default_factory=list)


class PortalSavedView(BaseModel):
    id: str
    name: str
    query: str = ""
    modules: list[str] = Field(default_factory=lambda: ["customers", "accounting"])
    teams: list[str] = Field(default_factory=list)
    updated_at: str = ""


class PortalActionCenterPrefsIn(BaseModel):
    saved_views: list[PortalSavedView] = Field(default_factory=list)
    default_view_id: str | None = None
    team_queue_mode: str = "role_default"
    role_queue_overrides: dict[str, str] = Field(default_factory=dict)


class PortalActionCenterPrefsOut(BaseModel):
    saved_views: list[PortalSavedView] = Field(default_factory=list)
    default_view_id: str | None = None
    team_queue_mode: str = "role_default"
    role_queue_overrides: dict[str, str] = Field(default_factory=dict)
    updated_at: str | None = None


class ActionCenterQueueItem(BaseModel):
    id: str
    module: str
    queue: str
    title: str
    detail: str
    status: str
    priority: str
    due_at: str = ""
    owner: str = ""
    url: str


class ActionCenterQueueSummary(BaseModel):
    customer_tasks: int = 0
    accounting_approvals: int = 0
    accounting_exceptions: int = 0
    accounting_reviews: int = 0


class ActionCenterQueueOut(BaseModel):
    role: str
    team_mode: str
    summary: ActionCenterQueueSummary
    items: list[ActionCenterQueueItem] = Field(default_factory=list)
