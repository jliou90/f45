from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .models import Appointment


def default_end(start, end):
    return end or (start + timedelta(minutes=30))


def validate_times(start, end):
    if end <= start:
        raise HTTPException(status_code=400, detail="scheduled_end must be after scheduled_start")


def check_vehicle_overlap(
    db: Session,
    tenant_id: str,
    vehicle_id: str | None,
    start,
    end,
    exclude_id: str | None = None,
):
    if not vehicle_id:
        return

    q = db.query(Appointment).filter(
        Appointment.tenant_id == tenant_id,
        Appointment.vehicle_id == vehicle_id,
        Appointment.status != "canceled",
        Appointment.scheduled_start < end,
        or_(
            (Appointment.scheduled_end.isnot(None) & (Appointment.scheduled_end > start)),
            (Appointment.scheduled_end.is_(None) & (Appointment.scheduled_start > start)),
        ),
    )
    if exclude_id:
        q = q.filter(Appointment.id != exclude_id)

    if q.first():
        raise HTTPException(
            status_code=409,
            detail=f"appointment overlap for vehicle_id={vehicle_id}",
        )
