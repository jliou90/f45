from __future__ import annotations

from datetime import datetime
from enum import Enum
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


class CustomerSummaryOut(BaseModel):
    id: str
    dms_customer_id: str
    name: str
    primary_phone: str
    primary_email: str
    household_id: str
    garage_count: int
    notes_count: int
    last_communication_at: str


class CustomerUpdate(BaseModel):
    # full replace semantics for profile fields
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
# Customer CRM profile
# ----------------------------

class CustomerPhone(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(default="", max_length=100)
    number: str = Field(default="", max_length=50)
    primary: bool = False


class CustomerEmail(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=255)
    primary: bool = False


class CustomerGarageVehicle(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    year: str = Field(default="", max_length=10)
    make: str = Field(default="", max_length=100)
    model: str = Field(default="", max_length=100)
    vin: str = Field(default="", max_length=32)
    nickname: str = Field(default="", max_length=120)


class CustomerNote(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(default="", max_length=5000)
    created_at: datetime


class CommunicationChannel(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"
    IN_PERSON = "in_person"
    OTHER = "other"


class CommunicationDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CustomerCommunication(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    channel: CommunicationChannel
    direction: CommunicationDirection
    subject: str = Field(default="", max_length=255)
    summary: str = Field(default="", max_length=5000)
    happened_at: datetime


class CustomerTask(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(default="", max_length=255)
    due_at: datetime | None = None
    status: str = Field(default="open", max_length=30)
    owner: str = Field(default="", max_length=120)
    notes: str = Field(default="", max_length=2000)


class CustomerAttachment(BaseModel):
    attachment_id: str = Field(min_length=1, max_length=100)
    filename: str = Field(default="", max_length=255)
    mime_type: str = Field(default="", max_length=200)
    size: int = Field(default=0, ge=0)
    linked_at: datetime


class CustomerSpouse(BaseModel):
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=100)
    phone: str = Field(default="", max_length=50)
    email: str = Field(default="", max_length=255)
    notes: str = Field(default="", max_length=5000)


class CustomerHousehold(BaseModel):
    household_id: str = Field(default="", max_length=64)
    relationship: str = Field(default="", max_length=100)
    linked_customer_ids: list[str] = Field(default_factory=list)


class CustomerCrmProfileUpsert(BaseModel):
    dms_customer_id: str = Field(default="", max_length=64)
    spouse: CustomerSpouse = Field(default_factory=CustomerSpouse)
    household: CustomerHousehold = Field(default_factory=CustomerHousehold)
    phones: list[CustomerPhone] = Field(default_factory=list)
    emails: list[CustomerEmail] = Field(default_factory=list)
    garage: list[CustomerGarageVehicle] = Field(default_factory=list)
    notes: list[CustomerNote] = Field(default_factory=list)
    communications: list[CustomerCommunication] = Field(default_factory=list)
    tasks: list[CustomerTask] = Field(default_factory=list)
    attachments: list[CustomerAttachment] = Field(default_factory=list)


class CustomerCrmProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    customer_id: str
    version: int

    dms_customer_id: str
    spouse: CustomerSpouse
    household: CustomerHousehold
    phones: list[CustomerPhone]
    emails: list[CustomerEmail]
    garage: list[CustomerGarageVehicle]
    notes: list[CustomerNote]
    communications: list[CustomerCommunication]
    tasks: list[CustomerTask]
    attachments: list[CustomerAttachment]


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
    technician_user_id: str | None = None
    service_advisor_user_id: str | None = None


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
    technician_user_id: str | None
    service_advisor_user_id: str | None


class AppointmentUpdate(BaseModel):
    scheduled_start: datetime
    scheduled_end: datetime | None = None

    vehicle_id: str | None = None
    status: str | None = Field(default=None, max_length=30)
    notes: str | None = None
    technician_user_id: str | None = None
    service_advisor_user_id: str | None = None


class AppointmentPatch(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None

    vehicle_id: str | None = None
    status: str | None = Field(default=None, max_length=30)
    notes: str | None = None
    technician_user_id: str | None = None
    service_advisor_user_id: str | None = None
