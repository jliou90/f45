from __future__ import annotations

from app.modules.eventstore.models import Event


def project_inventory_unit(events: list[Event]) -> dict:
    state: dict = {
        "unit_id": None,
        "vehicle_id": None,
        "vin": None,
        "state": "acquired",
        "acquired_cost_cents": 0,
        "recon_items": [],
        "total_recon_cents": 0,
        "total_cost_cents": 0,
        "history": [],
        "created_at": None,
        "updated_at": None,
    }

    for ev in events:
        payload = ev.payload or {}
        when = ev.occurred_at.isoformat()
        state["updated_at"] = when
        if state["created_at"] is None:
            state["created_at"] = when

        if ev.event_type == "inventory.acquired":
            state["unit_id"] = payload.get("unit_id") or ev.stream_id
            state["vehicle_id"] = payload.get("vehicle_id")
            state["vin"] = payload.get("vin")
            state["acquired_cost_cents"] = int(payload.get("acquired_cost_cents") or 0)
            state["state"] = "acquired"
        elif ev.event_type == "inventory.recon_item_added":
            item = {
                "name": payload.get("name"),
                "cost_cents": int(payload.get("cost_cents") or 0),
                "notes": payload.get("notes"),
                "added_at": when,
            }
            state["recon_items"].append(item)
        elif ev.event_type == "inventory.transitioned":
            to_state = payload.get("to_state")
            if to_state:
                state["state"] = to_state
            state["history"].append(
                {
                    "from_state": payload.get("from_state"),
                    "to_state": payload.get("to_state"),
                    "reason": payload.get("reason"),
                    "at": when,
                }
            )

    total_recon = sum(int(i.get("cost_cents") or 0) for i in state["recon_items"])
    state["total_recon_cents"] = total_recon
    state["total_cost_cents"] = int(state.get("acquired_cost_cents") or 0) + total_recon
    return state
