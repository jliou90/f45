from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeVar

from app.core.pagination import PageMeta, PageResult
from app.core.querying import Page, apply_paging
from sqlalchemy.orm import Query as SAQuery

T = TypeVar("T")

def paginate_query(
    q: SAQuery,
    *,
    page: Page,
    item_map: Callable[[object], T],
) -> PageResult[T]:
    """
    Canonical pagination:
      - total = count() BEFORE limit/offset
      - items = mapped results AFTER paging
    """
    total = q.order_by(None).count()
    items = [item_map(x) for x in apply_paging(q, page).all()]
    return PageResult(items=items, meta=PageMeta(page=page.page, size=page.size, total=total))


def paginate_items(
    items: Iterable[object],
    *,
    page: Page,
    item_map: Callable[[object], T],
) -> PageResult[T]:
    seq = list(items)
    total = len(seq)
    start = page.offset
    end = start + page.size
    return PageResult(
        items=[item_map(x) for x in seq[start:end]],
        meta=PageMeta(page=page.page, size=page.size, total=total),
    )
