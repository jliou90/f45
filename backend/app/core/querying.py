from __future__ import annotations

from dataclasses import dataclass

import sqlalchemy as sa
from app.core.errors import AppError
from fastapi import Query
from sqlalchemy.orm import Query as SAQuery


@dataclass(frozen=True)
class Page:
    page: int = 1
    size: int = 25

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=200)) -> Page:
    return Page(page=page, size=size)


@dataclass(frozen=True)
class Sort:
    fields: tuple[str, ...] = ()


def sort_params(
    sort: str | None = Query(
        default=None,
        description="Comma-separated sort fields, e.g. field,-field",
    )
) -> Sort:
    if not sort:
        return Sort(())
    parts = [p.strip() for p in sort.split(",") if p.strip()]
    return Sort(tuple(parts))


@dataclass(frozen=True)
class Filters:
    raw: tuple[str, ...] = ()


def filter_params(f: list[str] | None = Query(None)) -> Filters:
    if not f:
        return Filters(())
    parts: list[str] = []
    for item in f:
        parts.extend([p.strip() for p in item.split("&") if p.strip()])
    return Filters(tuple(parts))


OP_MAP = {"eq", "ne", "lt", "lte", "gt", "gte", "like", "ilike", "in", "contains"}


def _col(model, field: str):
    if not hasattr(model, field):
        raise AppError(code="bad_filter_field", message=f"Unknown field: {field}", status_code=400)
    return getattr(model, field)


def apply_sort(q: SAQuery, model, sort: Sort, allowed: set[str] | None = None) -> SAQuery:
    if not sort.fields:
        return q
    order = []
    for token in sort.fields:
        desc = token.startswith("-")
        name = token[1:] if desc else token
        if allowed and name not in allowed:
            raise AppError(code="bad_sort_field", message=f"Sort not allowed: {name}", status_code=400)
        col = _col(model, name)
        order.append(col.desc() if desc else col.asc())
    return q.order_by(*order)


def parse_sort_fields(sort: Sort, *, allowed: set[str] | None = None) -> tuple[tuple[str, bool], ...]:
    parsed: list[tuple[str, bool]] = []
    for token in sort.fields:
        desc = token.startswith("-")
        name = token[1:] if desc else token
        if allowed and name not in allowed:
            raise AppError(code="bad_sort_field", message=f"Sort not allowed: {name}", status_code=400)
        parsed.append((name, desc))
    return tuple(parsed)


def apply_filters(q: SAQuery, model, filters: Filters, allowed: set[str] | None = None) -> SAQuery:
    if not filters.raw:
        return q
    for expr in filters.raw:
        parts = expr.split(":", 2)
        if len(parts) != 3:
            raise AppError(code="bad_filter_format", message=f"Bad filter: {expr}", status_code=400)
        field, op, value = parts
        field = field.strip()
        op = op.strip().lower()
        value = value.strip()

        if op not in OP_MAP:
            raise AppError(code="bad_filter_op", message=f"Bad filter op: {op}", status_code=400)
        if allowed and field not in allowed:
            raise AppError(code="bad_filter_field", message=f"Filter not allowed: {field}", status_code=400)

        col = _col(model, field)

        if op == "eq":
            q = q.filter(col == value)
        elif op == "ne":
            q = q.filter(col != value)
        elif op == "lt":
            q = q.filter(col < value)
        elif op == "lte":
            q = q.filter(col <= value)
        elif op == "gt":
            q = q.filter(col > value)
        elif op == "gte":
            q = q.filter(col >= value)
        elif op == "like":
            q = q.filter(col.like(value))
        elif op == "ilike":
            q = q.filter(col.ilike(value))
        elif op == "contains":
            q = q.filter(sa.cast(col, sa.String).ilike(f"%{value}%"))
        elif op == "in":
            vals = [v.strip() for v in value.split(",") if v.strip()]
            if not vals:
                raise AppError(code="bad_filter_in", message=f"Empty IN values for {field}", status_code=400)
            q = q.filter(col.in_(vals))
    return q


def apply_paging(q: SAQuery, page: Page) -> SAQuery:
    return q.offset(page.offset).limit(page.size)


@dataclass(frozen=True)
class Search:
    q: str | None = None


def search_params(q: str | None = Query(None, description="Free-text search query")) -> Search:
    return Search(q=q)

