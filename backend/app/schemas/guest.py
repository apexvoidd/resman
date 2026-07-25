"""
Pydantic schemas for Guest Sessions, QR entrance table finding, and queue allocations.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GuestSessionInitOut(BaseModel):
    session_token: str
    expires_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class GuestFindTableInput(BaseModel):
    guest_count: int = Field(..., ge=1, le=50, description="Number of guests in group")
    name: str | None = Field(None, max_length=255, description="Guest name (optional)")
    email: EmailStr | None = Field(None, description="Guest email (optional)")


class GuestTableReservationOut(BaseModel):
    session_token: str
    assigned: bool
    table_id: UUID | None = None
    table_number: str | None = None
    capacity: int | None = None
    reservation_expires_at: datetime | None = None
    remaining_seconds: int | None = None
    verification_status: str = "none"
    rejection_reason: str | None = None
    menu_unlocked: bool = False
    in_queue: bool = False
    queue_id: UUID | None = None
    queue_position: int | None = None
    estimated_wait_minutes: int | None = None
    cooldown_active: bool = False
    cooldown_remaining_seconds: int | None = None
    message: str


class GuestStatusOut(BaseModel):
    session_token: str
    guest_name: str | None = None
    guest_count: int | None = None
    has_active_reservation: bool
    table_id: UUID | None = None
    table_number: str | None = None
    capacity: int | None = None
    table_status: str | None = None
    reservation_expires_at: datetime | None = None
    remaining_seconds: int | None = None
    verification_status: str = "none"
    rejection_reason: str | None = None
    menu_unlocked: bool = False
    in_queue: bool
    queue_id: UUID | None = None
    queue_position: int | None = None
    estimated_wait_minutes: int | None = None
    cooldown_active: bool = False
    cooldown_remaining_seconds: int | None = None
    message: str


class VerificationActionInput(BaseModel):
    action: Literal["confirm", "reject"]
    reason: Annotated[str | None, Field(max_length=500)] = None


class PendingVerificationTable(BaseModel):
    table_id: UUID
    table_number: str
    capacity: int
    guest_session_id: UUID
    guest_name: str | None = None
    guest_count: int
    verification_requested_at: datetime | None = None
    time_elapsed_seconds: int = 0
