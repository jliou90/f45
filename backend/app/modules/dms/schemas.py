from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# ----------------------------
# Shared helpers
# ----------------------------

StrTrim = Annotated[str, Field(min_length=1)]


# ----------------------------
# Customers
# ----------------------------

class CustomerCreate(BaseModel):
    first_name: StrTrim = Field(max_length=100)
    last_name: StrTrim = Field(max_length=100)

    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)

    address1: str | None = Field(default=None, max_length=255)
    address2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    zip: str | None = Field(default=None, max_length=10)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    version: int

    first_name: str
    last_name: str
    phone: str | None
    email: str | None
    address1: str | None
    address2: str | None
    city: str | None
    state: str | None
    zip: str | None


class CustomerUpdate(BaseModel):
    # full replace semantics for “profile” fields
    first_name: StrTrim = Field(max_length=100)
    last_name: StrTrim = Field(max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)

    address1: str | None = Field(default=None, max_length=255)
    address2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    zip: str | None = Field(default=None, max_length=10)


class CustomerPatch(BaseModel):
    # partial update semantics
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)

    address1: str | None = Field(default=None, max_length=255)
    address2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    zip: str | None = Field(default=None, max_length=10)


# ----------------------------
# Vehicles (Garage)
# ----------------------------

class VehicleCreate(BaseModel):
    vin: str = Field(min_length=11, max_length=17)
    customer_id: str | None = None

    year: int | None = Field(default=None, ge=1886, le=2100)
    make: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=50)
    trim: str | None = Field(default=None, max_length=50)
    mileage: int | None = Field(default=None, ge=0, le=2_000_000)


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    version: int

    customer_id: str | None
    vin: str
    year: int | None
    make: str | None
    model: str | None
    trim: str | None
    mileage: int | None


class VehicleUpdate(BaseModel):
    vin: str = Field(min_length=11, max_length=17)
    customer_id: str | None = None

    year: int | None = Field(default=None, ge=1886, le=2100)
    make: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=50)
    trim: str | None = Field(default=None, max_length=50)
    mileage: int | None = Field(default=None, ge=0, le=2_000_000)


class VehiclePatch(BaseModel):
    vin: str | None = Field(default=None, min_length=11, max_length=17)
    customer_id: str | None = None

    year: int | None = Field(default=None, ge=1886, le=2100)
    make: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=50)
    trim: str | None = Field(default=None, max_length=50)
    mileage: int | None = Field(default=None, ge=0, le=2_000_000)


# ----------------------------
# Appointments
# ----------------------------

class AppointmentCreate(BaseModel):
    customer_id: str
    vehicle_id: str | None = None

    scheduled_start: datetime
    scheduled_end: datetime | None = None

    status: str = Field(default="scheduled", max_length=30)
    notes: str | None = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    version: int

    customer_id: str
    vehicle_id: str | None
    scheduled_start: datetime
    scheduled_end: datetime | None
    status: str
    notes: str | None


class AppointmentUpdate(BaseModel):
    scheduled_start: datetime
    scheduled_end: datetime | None = None

    vehicle_id: str | None = None
    status: str | None = Field(default=None, max_length=30)
    notes: str | None = None


class AppointmentPatch(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None

    vehicle_id: str | None = None
    status: str | None = Field(default=None, max_length=30)
    notes: str | None = None
