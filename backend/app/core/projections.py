from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Projection:
    stream_type: str
    doc_type: str
    rebuild: Callable[[Session, str, str], object]


def get_projection_registry() -> list[Projection]:
    """Return available projection rebuilders.

    Importing inside the function avoids import cycles on app startup.
    """
    from app.modules.funding.service import rebuild_funding_checklist
    from app.modules.service_ro.service import rebuild_ro_summary

    return [
        Projection(stream_type="funding", doc_type="funding_checklist", rebuild=rebuild_funding_checklist),
        Projection(stream_type="ro", doc_type="ro_summary", rebuild=rebuild_ro_summary),
    ]
