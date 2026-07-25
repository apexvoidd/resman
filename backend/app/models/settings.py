"""
RestaurantSettings — operational and financial configuration for a restaurant.

Stored as a 1:1 companion to the Restaurant row so that the core Restaurant
entity stays lean and settings can be versioned / audited independently.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.restaurant import Restaurant


class RestaurantSettings(BaseModel):
    """Operational settings for a single restaurant."""

    __tablename__ = "restaurant_settings"
    __table_args__ = (
        UniqueConstraint("restaurant_id", name="uq_restaurant_settings_restaurant"),
    )

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    # (name / logo / address / phone / email are on the Restaurant row;
    #  only settings-specific overrides live here)
    gst_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Locale ────────────────────────────────────────────────────────────────
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(100), default="Asia/Kolkata", nullable=False
    )

    # ── Financial ─────────────────────────────────────────────────────────────
    tax_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0.0, nullable=False
    )
    service_charge_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0.0, nullable=False
    )

    # ── Operations ────────────────────────────────────────────────────────────
    reservation_timeout_minutes: Mapped[int] = mapped_column(
        Integer, default=15, nullable=False
    )
    queue_timeout_minutes: Mapped[int] = mapped_column(
        Integer, default=30, nullable=False
    )

    # ── Hours ─────────────────────────────────────────────────────────────────
    opening_time: Mapped[str | None] = mapped_column(
        String(5), nullable=True
    )  # stored as "HH:MM"
    closing_time: Mapped[str | None] = mapped_column(
        String(5), nullable=True
    )  # stored as "HH:MM"

    # ── Relationship ──────────────────────────────────────────────────────────
    restaurant: Mapped["Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant", back_populates="settings"
    )
