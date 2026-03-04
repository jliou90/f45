from __future__ import annotations

from app.modules.eventstore.models import Event


def project_ro_summary(events: list[Event]) -> dict:
    state: dict = {
        "ro_id": None,
        "status": "open",
        "customer_name": None,
        "vehicle": None,
        "payment_status": "unpaid",
        "inspection": {
            "items": [],
            "approved": [],
            "declined": [],
        },
        "parts": {
            "requested": [],
            "received": [],
        },
        "labor_lines": [],
        "parts_lines": [],
        "labor_total_cents": 0,
        "parts_total_cents": 0,
        "total_cents": 0,
        "opened_at": None,
        "closed_at": None,
        "last_event": None,
    }

    for ev in events:
        et = ev.event_type
        p = ev.payload or {}

        state["ro_id"] = p.get("ro_id") or state.get("ro_id") or ev.stream_id

        if et == "ro.opened":
            state["status"] = "open"
            state["customer_name"] = p.get("customer_name")
            state["vehicle"] = p.get("vehicle")
            state["opened_at"] = p.get("opened_at")

        elif et == "ro.check_in":
            state["status"] = "checked_in"
        elif et == "ro.authorized":
            state["status"] = "authorized"
        elif et in {"ro.started", "ro.in_progress"}:
            state["status"] = "in_progress"
        elif et == "ro.completed":
            state["status"] = "complete"

        elif et == "ro.inspection_add":
            item = p.get("item")
            if item:
                state["inspection"]["items"].append(item)

        elif et == "ro.inspection_approve":
            item = p.get("item")
            if item:
                state["inspection"]["approved"].append(item)

        elif et == "ro.inspection_decline":
            item = p.get("item")
            if item:
                state["inspection"]["declined"].append(item)

        elif et == "ro.parts_requested":
            part = p.get("part")
            if part:
                state["parts"]["requested"].append(part)

        elif et == "ro.parts_received":
            part = p.get("part")
            if part:
                state["parts"]["received"].append(part)
        elif et == "ro.labor_line_added":
            line_total = int(p.get("total_cents") or 0)
            if line_total <= 0:
                line_total = int(float(p.get("hours") or 0) * int(p.get("rate_cents") or 0))
            state["labor_lines"].append(
                {
                    "description": p.get("description"),
                    "hours": p.get("hours"),
                    "rate_cents": p.get("rate_cents"),
                    "total_cents": line_total,
                }
            )
        elif et == "ro.part_line_added":
            line_total = int(p.get("total_cents") or 0)
            if line_total <= 0:
                line_total = int(p.get("qty") or 0) * int(p.get("unit_cents") or 0)
            state["parts_lines"].append(
                {
                    "part_no": p.get("part_no"),
                    "qty": p.get("qty"),
                    "unit_cents": p.get("unit_cents"),
                    "total_cents": line_total,
                }
            )
        elif et == "ro.payment_updated":
            if p.get("payment_status"):
                state["payment_status"] = p.get("payment_status")

        elif et == "ro.closed":
            state["status"] = "closed"
            state["closed_at"] = p.get("closed_at")

        state["last_event"] = {"type": et, "version": ev.version}

    state["inspection"]["count"] = len(state["inspection"]["items"])
    state["inspection"]["approved_count"] = len(state["inspection"]["approved"])
    state["inspection"]["declined_count"] = len(state["inspection"]["declined"])

    state["parts"]["requested_count"] = len(state["parts"]["requested"])
    state["parts"]["received_count"] = len(state["parts"]["received"])
    state["labor_total_cents"] = sum(int(x.get("total_cents") or 0) for x in state["labor_lines"])
    state["parts_total_cents"] = sum(int(x.get("total_cents") or 0) for x in state["parts_lines"])
    state["total_cents"] = int(state["labor_total_cents"]) + int(state["parts_total_cents"])

    return state
