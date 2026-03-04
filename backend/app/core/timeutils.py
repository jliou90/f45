from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import Header

DEFAULT_TZ = "UTC"

def tz_dep(x_tz: str | None = Header(None, alias="X-TZ")) -> ZoneInfo:
    if not x_tz:
        return ZoneInfo(DEFAULT_TZ)
    try:
        return ZoneInfo(x_tz)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)

def day_bounds_utc(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    local_start = datetime.combine(day, time.min).replace(tzinfo=tz)
    start_utc = local_start.astimezone(UTC)
    end_utc = (local_start + timedelta(days=1)).astimezone(UTC)
    return start_utc, end_utc
