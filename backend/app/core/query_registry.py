from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

# A declarative contract for query behavior per model.
# - filter_fields: what apply_filters is allowed to touch
# - sort_fields: what apply_sort is allowed to touch
# - search_fields: what your search layer is allowed to touch (when you wire it)
# - default_sort: optional canonical default sort (e.g. ["-created_at"])


@dataclass(frozen=True)
class QueryContract:
    filter_fields: frozenset[str]
    sort_fields: frozenset[str]
    search_fields: frozenset[str] = frozenset()
    default_sort: tuple[str, ...] = ()


def _fs(items: Iterable[str]) -> frozenset[str]:
    return frozenset(items)


# --- Core registry keyed by model class ---
REGISTRY: dict[type[Any], QueryContract] = {}


def register(model: type[Any], contract: QueryContract) -> None:
    REGISTRY[model] = contract


def contract_for(model: type[Any]) -> QueryContract:
    try:
        return REGISTRY[model]
    except KeyError as e:
        raise KeyError(f"No QueryContract registered for model: {model!r}") from e


def allowed_filter_fields(model: type[Any]) -> frozenset[str]:
    return contract_for(model).filter_fields


def allowed_sort_fields(model: type[Any]) -> frozenset[str]:
    return contract_for(model).sort_fields


def allowed_search_fields(model: type[Any]) -> frozenset[str]:
    return contract_for(model).search_fields


# --- Default bootstrap registrations (DMS + Tenancy + EventStore) ---
# NOTE: keep these conservative; expand as needed.
def bootstrap_default_registry() -> None:
    # Imports are inside to avoid circular import issues at module import time
    from app.modules.dms.models import Appointment, Customer, Vehicle
    from app.modules.eventstore.models import Event
    from app.modules.tenancy.models import Tenant

    register(Customer, QueryContract(
        filter_fields=_fs([
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
        ]),
        sort_fields=_fs([
            "first_name",
            "last_name",
            "email",
            "phone",
            "created_at",
            "updated_at",
        ]),
        search_fields=_fs([
            "first_name",
            "last_name",
            "phone",
            "email",
        ]),
        default_sort=("last_name", "first_name"),
    ))

    register(Vehicle, QueryContract(
        filter_fields=_fs([
            "id",
            "vin",
            "year",
            "make",
            "model",
            "trim",
            "customer_id",
        ]),
        sort_fields=_fs([
            "vin",
            "year",
            "make",
            "model",
            "trim",
            "created_at",
            "updated_at",
        ]),
        search_fields=_fs([
            "vin",
            "make",
            "model",
            "trim",
        ]),
        default_sort=("year", "make", "model"),
    ))

    register(Appointment, QueryContract(
        filter_fields=_fs([
            "id",
            "customer_id",
            "vehicle_id",
            "status",
            "scheduled_start",
            "scheduled_end",
        ]),
        sort_fields=_fs([
            "scheduled_start",
            "scheduled_end",
            "status",
            "created_at",
            "updated_at",
        ]),
        search_fields=_fs([
            "notes",
            "status",
        ]),
        default_sort=("scheduled_start",),
    ))

    register(Tenant, QueryContract(
        filter_fields=_fs([
            "id",
            "name",
        ]),
        sort_fields=_fs([
            "name",
            "created_at",
            "updated_at",
        ]),
        search_fields=_fs([
            "name",
        ]),
        default_sort=("name",),
    ))

    register(Event, QueryContract(
        filter_fields=_fs([
            "id",
            "stream_type",
            "stream_id",
            "event_type",
            "version",
            "recorded_at",
            "occurred_at",
            "actor_id",
            "correlation_id",
            "causation_id",
        ]),
        sort_fields=_fs([
            "version",
            "recorded_at",
            "occurred_at",
        ]),
        search_fields=_fs([
            "event_type",
            "stream_type",
            "stream_id",
            "correlation_id",
            "causation_id",
        ]),
        default_sort=("version",),
    ))


# Bootstrap on import (safe: only registers contracts)
bootstrap_default_registry()
