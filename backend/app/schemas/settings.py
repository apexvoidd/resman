"""
Pydantic schemas for RestaurantSettings API.
"""

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

# ── Helper validators ──────────────────────────────────────────────────────────

_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")  # HH:MM 24-hour


def _validate_time(v: str | None, field_name: str) -> str | None:
    if v is None:
        return v
    if not _TIME_RE.match(v):
        raise ValueError(f"{field_name} must be in HH:MM 24-hour format (e.g. '09:00')")
    return v


# ── Combined response (restaurant + settings) ─────────────────────────────────


class RestaurantSettingsOut(BaseModel):
    """Full response shape for GET /settings."""

    model_config = {"from_attributes": True}

    # From Restaurant
    id: uuid.UUID
    name: str
    logo_url: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None

    # From RestaurantSettings
    settings_id: uuid.UUID | None = None
    gst_number: str | None = None
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    tax_percentage: float = 0.0
    service_charge_percentage: float = 0.0
    reservation_timeout_minutes: int = 15
    queue_timeout_minutes: int = 30
    opening_time: str | None = None
    closing_time: str | None = None

    updated_at: datetime


# ── Request body for PUT /settings ────────────────────────────────────────────


class RestaurantSettingsUpdate(BaseModel):
    """Payload for PUT /settings. All fields are optional (PATCH semantics)."""

    # Restaurant-level fields
    name: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    address: Annotated[str | None, Field(max_length=1000)] = None
    phone: Annotated[str | None, Field(max_length=50)] = None
    email: Annotated[str | None, Field(max_length=255)] = None

    # Settings-level fields
    gst_number: Annotated[str | None, Field(max_length=50)] = None
    currency: Annotated[str | None, Field(min_length=3, max_length=10)] = None
    timezone: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    tax_percentage: Annotated[float | None, Field(ge=0, le=100)] = None
    service_charge_percentage: Annotated[float | None, Field(ge=0, le=100)] = None
    reservation_timeout_minutes: Annotated[int | None, Field(ge=1, le=1440)] = None
    queue_timeout_minutes: Annotated[int | None, Field(ge=1, le=1440)] = None
    opening_time: str | None = None
    closing_time: str | None = None

    @field_validator("opening_time")
    @classmethod
    def validate_opening(cls, v: str | None) -> str | None:
        return _validate_time(v, "opening_time")

    @field_validator("closing_time")
    @classmethod
    def validate_closing(cls, v: str | None) -> str | None:
        return _validate_time(v, "closing_time")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is not None and "@" not in v:
            raise ValueError("email must be a valid email address")
        return v

    @model_validator(mode="after")
    def validate_times_order(self) -> "RestaurantSettingsUpdate":
        """opening_time must be before closing_time when both are set."""
        if self.opening_time and self.closing_time:
            if self.opening_time >= self.closing_time:
                raise ValueError("opening_time must be earlier than closing_time")
        return self


# ── Logo upload response ───────────────────────────────────────────────────────


class LogoUploadOut(BaseModel):
    logo_url: str
    message: str = "Logo uploaded successfully"
