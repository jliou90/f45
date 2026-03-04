from __future__ import annotations

from app.modules.eventstore.models import Event


def project_funding_checklist(events: list[Event]) -> dict:
    """Deterministically build the funding checklist document from events."""
    state: dict = {
        "deal_id": None,
        "status": "new",
        "lender": None,
        "created_at": None,
        "updated_at": None,
        "stips": [],  # list of {name, status, requested_at, received_at, notes}
        "notes": "",
    }

    stips_index: dict[str, int] = {}

    for ev in events:
        t = ev.event_type
        payload = ev.payload or {}
        occurred = ev.occurred_at.isoformat()

        state["updated_at"] = occurred
        if state["created_at"] is None:
            state["created_at"] = occurred

        if t == "funding.deal_created":
            state["deal_id"] = payload.get("deal_id") or ev.stream_id
            state["status"] = "open"
            state["customer"] = payload.get("customer")
            state["vehicle"] = payload.get("vehicle")
            state["amounts"] = payload.get("amounts")
        elif t == "funding.lender_selected":
            state["lender"] = payload.get("lender")
        elif t == "funding.stip_requested":
            name = payload.get("name")
            if name:
                idx = stips_index.get(name)
                if idx is None:
                    stips_index[name] = len(state["stips"])
                    state["stips"].append(
                        {
                            "name": name,
                            "status": "requested",
                            "requested_at": occurred,
                            "received_at": None,
                            "rejected_at": None,
                            "notes": payload.get("notes"),
                        }
                    )
                else:
                    state["stips"][idx]["status"] = "requested"
                    state["stips"][idx]["requested_at"] = occurred
                    state["stips"][idx]["notes"] = payload.get("notes")
        elif t == "funding.stip_received":
            name = payload.get("name")
            if name and name in stips_index:
                idx = stips_index[name]
                state["stips"][idx]["status"] = "received"
                state["stips"][idx]["received_at"] = occurred
        elif t == "funding.stip_rejected":
            name = payload.get("name")
            if name and name in stips_index:
                idx = stips_index[name]
                state["stips"][idx]["status"] = "rejected"
                state["stips"][idx]["rejected_at"] = occurred
                state["stips"][idx]["notes"] = payload.get("notes")
        elif t == "funding.sent_to_lender":
            state["status"] = "sent"
        elif t == "funding.funded":
            state["status"] = "funded"
            state["funded_at"] = occurred
        elif t == "funding.closed":
            state["status"] = "closed"
        elif t == "funding.note_added":
            note = payload.get("note")
            if note:
                existing = state.get("notes") or ""
                state["notes"] = (existing + "\n" + note).strip()

    # Derived helpers
    outstanding = [s for s in state["stips"] if s.get("status") not in ("received",)]
    state["stips_outstanding"] = len(outstanding)
    return state
