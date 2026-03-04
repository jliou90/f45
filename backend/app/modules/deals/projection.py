from __future__ import annotations

from app.modules.eventstore.models import Event


def project_deal_summary(events: list[Event]) -> dict:
    state: dict = {
        "deal_id": None,
        "state": "quote",
        "customer_id": None,
        "vehicle_id": None,
        "quote_amount_cents": 0,
        "required_docs": {},
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

        if ev.event_type == "deal.created":
            state["deal_id"] = payload.get("deal_id") or ev.stream_id
            state["state"] = "quote"
            state["customer_id"] = payload.get("customer_id")
            state["vehicle_id"] = payload.get("vehicle_id")
            state["quote_amount_cents"] = int(payload.get("quote_amount_cents") or 0)
        elif ev.event_type == "deal.transitioned":
            state["state"] = payload.get("to_state", state["state"])
            for k, v in (payload.get("required_docs") or {}).items():
                state["required_docs"][k] = v
            state["history"].append(
                {
                    "from_state": payload.get("from_state"),
                    "to_state": payload.get("to_state"),
                    "reason": payload.get("reason"),
                    "at": when,
                }
            )

    return state
