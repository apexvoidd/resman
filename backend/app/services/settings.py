"""
Business logic for restaurant settings — get and update.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurant import Restaurant
from app.models.settings import RestaurantSettings
from app.schemas.settings import RestaurantSettingsOut, RestaurantSettingsUpdate

logger = logging.getLogger("app.services.settings")


async def get_first_restaurant(db: AsyncSession) -> Restaurant:
    """
    Returns the first active restaurant.

    In a single-tenant deployment there is exactly one restaurant row.
    Multi-tenant support (restaurant_id per user) can be layered on later.
    """
    result = await db.execute(
        select(Restaurant)
        .where(Restaurant.is_active.is_(True))
        .options(selectinload(Restaurant.settings))
        .limit(1)
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        # Fallback: find any restaurant row
        res_any = await db.execute(
            select(Restaurant).options(selectinload(Restaurant.settings)).limit(1)
        )
        restaurant = res_any.scalar_one_or_none()

    if restaurant is None:
        # Auto-create default restaurant and settings
        restaurant = Restaurant(
            name="Smart Restaurant",
            is_active=True,
        )
        db.add(restaurant)
        await db.commit()
        await db.refresh(restaurant)

        settings_row = RestaurantSettings(restaurant_id=restaurant.id)
        db.add(settings_row)
        await db.commit()
        await db.refresh(restaurant)

    return restaurant


def _build_out(restaurant: Restaurant) -> RestaurantSettingsOut:
    """Map restaurant + settings rows into a flat response DTO."""
    s = restaurant.settings  # may be None on first load

    return RestaurantSettingsOut(
        id=restaurant.id,
        name=restaurant.name,
        logo_url=restaurant.logo_url,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        updated_at=restaurant.updated_at,
        # Settings fields — fall back to defaults when no settings row yet
        settings_id=s.id if s else None,
        gst_number=s.gst_number if s else None,
        currency=s.currency if s else "INR",
        timezone=s.timezone if s else "Asia/Kolkata",
        tax_percentage=float(s.tax_percentage) if s else 0.0,
        service_charge_percentage=float(s.service_charge_percentage) if s else 0.0,
        reservation_timeout_minutes=s.reservation_timeout_minutes if s else 15,
        queue_timeout_minutes=s.queue_timeout_minutes if s else 30,
        opening_time=s.opening_time if s else None,
        closing_time=s.closing_time if s else None,
    )


async def get_settings(db: AsyncSession) -> RestaurantSettingsOut:
    restaurant = await get_first_restaurant(db)
    return _build_out(restaurant)


async def update_settings(
    db: AsyncSession,
    payload: RestaurantSettingsUpdate,
    *,
    logo_url: str | None = None,
) -> RestaurantSettingsOut:
    """
    Apply a partial update to the restaurant and its settings row.
    Creates the settings row on first call (upsert-style).
    """
    restaurant = await get_first_restaurant(db)

    # ── Update Restaurant fields ──────────────────────────────────────────────
    restaurant_fields = ("name", "address", "phone", "email")
    for field in restaurant_fields:
        value = getattr(payload, field)
        if value is not None:
            setattr(restaurant, field, value)

    if logo_url is not None:
        restaurant.logo_url = logo_url

    # ── Upsert RestaurantSettings row ─────────────────────────────────────────
    if restaurant.settings is None:
        restaurant.settings = RestaurantSettings(restaurant_id=restaurant.id)
        db.add(restaurant.settings)

    s = restaurant.settings
    settings_fields = (
        "gst_number",
        "currency",
        "timezone",
        "tax_percentage",
        "service_charge_percentage",
        "reservation_timeout_minutes",
        "queue_timeout_minutes",
        "opening_time",
        "closing_time",
    )
    for field in settings_fields:
        value = getattr(payload, field)
        if value is not None:
            setattr(s, field, value)

    await db.commit()
    await db.refresh(restaurant)
    await db.refresh(s)

    logger.info("Restaurant settings updated: restaurant_id=%s", restaurant.id)
    return _build_out(restaurant)
