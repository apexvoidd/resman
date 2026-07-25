"""
Service layer for Kitchen Display System (KDS) order workflows, status state machine,
priority escalation, preparation time estimation, pause/resume, and waiter notifications.
"""

import logging
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.settings import settings
from app.models.customer import GuestSession
from app.models.notification import Notification
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.schemas.order import OrderOut
from app.services.order import _build_order_out
from app.services.recipe import deduct_inventory_for_order

logger = logging.getLogger("app.services.kds")

# Valid state machine transitions
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["accepted", "preparing", "ready", "cancelled", "paused"],
    "accepted": ["preparing", "ready", "cancelled", "paused"],
    "preparing": ["ready", "cancelled", "paused"],
    "ready": ["completed", "served", "cancelled", "paused"],
    "paused": ["pending", "accepted", "preparing", "ready"],
}


def _validate_transition(current_status: str, target_status: str) -> None:
    """Enforce valid KDS status transitions."""
    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current_status}' to '{target_status}'. Allowed: {allowed}",
        )


async def get_kds_active_orders(
    db: AsyncSession,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    sort_by: str | None = "oldest",  # oldest, newest, longest_waiting
) -> list[OrderOut]:
    """
    Fetch active KDS orders for kitchen display dashboard with search, status filtering, and sorting.
    """
    query = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
            selectinload(Order.guest_session),
        )
        .where(Order.deleted_at.is_(None))
    )

    if status_filter in ("active", "all", None, ""):
        # By default filter to active orders (pending, accepted, preparing, ready, paused)
        query = query.where(Order.status.in_(["pending", "accepted", "preparing", "ready", "paused"]))
    elif status_filter == "everything":
        # Return all orders including completed and cancelled
        pass
    elif status_filter:
        query = query.where(Order.status == status_filter)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(Order.order_number.ilike(term))

    if sort_by == "newest":
        query = query.order_by(Order.created_at.desc())
    elif sort_by == "longest_waiting":
        query = query.order_by(Order.created_at.asc())
    else:  # oldest
        query = query.order_by(Order.created_at.asc())

    result = await db.execute(query)
    orders = result.scalars().all()
    return [_build_order_out(o) for o in orders]


def _order_select_options():
    return [
        selectinload(Order.items).selectinload(OrderItem.menu_item),
        selectinload(Order.table),
        selectinload(Order.guest_session),
    ]


async def _get_order_for_update(db: AsyncSession, order_id: uuid.UUID) -> Order:
    stmt = (
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order_id, Order.deleted_at.is_(None))
    )
    if not settings.DATABASE_URL.startswith("sqlite"):
        stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order


async def accept_order(
    db: AsyncSession, order_id: uuid.UUID, estimated_prep_minutes: int, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Accept order and set estimated preparation time."""
    order = await _get_order_for_update(db, order_id)
    _validate_transition(order.status, "accepted")

    # Perform automatic inventory stock verification and atomic deduction
    await deduct_inventory_for_order(db, order, user_id)

    now = datetime.now(timezone.utc)
    prev_st = order.status
    order.status = "accepted"
    order.estimated_prep_minutes = estimated_prep_minutes
    order.estimated_completion_at = now + timedelta(minutes=estimated_prep_minutes)

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="accepted",
            changed_by_user_id=user_id,
            notes=f"Kitchen accepted order with estimated prep time of {estimated_prep_minutes} minutes.",
        )
    )

    await db.commit()

    # Re-query
    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def start_preparing(
    db: AsyncSession, order_id: uuid.UUID, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Transition order status from accepted to preparing."""
    order = await _get_order_for_update(db, order_id)
    _validate_transition(order.status, "preparing")

    prev_st = order.status
    order.status = "preparing"

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="preparing",
            changed_by_user_id=user_id,
            notes="Kitchen started preparing order.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def mark_order_ready(
    db: AsyncSession, order_id: uuid.UUID, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Mark order as ready and send real-time notification to waiters."""
    order = await _get_order_for_update(db, order_id)
    _validate_transition(order.status, "ready")

    # If marking ready directly from pending, deduct ingredient inventory
    if order.status == "pending":
        await deduct_inventory_for_order(db, order, user_id)

    prev_st = order.status
    order.status = "ready"

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="ready",
            changed_by_user_id=user_id,
            notes="Kitchen marked order as ready for serving.",
        )
    )

    # Real-time Waiter Notification
    tbl_num = order.table.table_number if order.table else "assigned table"
    db.add(
        Notification(
            recipient_type="waiter",
            title=f"🔔 Order {order.order_number} Ready!",
            message=f"Order {order.order_number} for Table {tbl_num} is ready for serving.",
            notification_type="order_ready",
            status="unread",
            payload_json={"order_id": str(order.id), "table_number": tbl_num},
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def mark_order_completed(
    db: AsyncSession, order_id: uuid.UUID, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Mark order as completed/served."""
    order = await _get_order_for_update(db, order_id)
    _validate_transition(order.status, "completed")

    prev_st = order.status
    order.status = "completed"

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="completed",
            changed_by_user_id=user_id,
            notes="Order marked as completed.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def update_prep_time(
    db: AsyncSession, order_id: uuid.UUID, estimated_prep_minutes: int, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Update estimated preparation time."""
    order = await _get_order_for_update(db, order_id)
    now = datetime.now(timezone.utc)
    order.estimated_prep_minutes = estimated_prep_minutes
    order.estimated_completion_at = now + timedelta(minutes=estimated_prep_minutes)

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=order.status,
            new_status=order.status,
            changed_by_user_id=user_id,
            notes=f"Kitchen updated estimated prep time to {estimated_prep_minutes} minutes.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def update_priority(
    db: AsyncSession, order_id: uuid.UUID, priority: str, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Update order priority (Normal, High, Urgent). Manager role."""
    order = await _get_order_for_update(db, order_id)
    order.priority = priority

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=order.status,
            new_status=order.status,
            changed_by_user_id=user_id,
            notes=f"Order priority updated to {priority.upper()}.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def pause_order(
    db: AsyncSession, order_id: uuid.UUID, reason: str | None = None, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Temporarily pause order preparation."""
    order = await _get_order_for_update(db, order_id)
    prev_st = order.status
    order.is_paused = True
    order.paused_at = datetime.now(timezone.utc)
    order.status = "paused"

    note_text = f"Order paused by kitchen. Reason: {reason}" if reason else "Order paused by kitchen."
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="paused",
            changed_by_user_id=user_id,
            notes=note_text,
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def resume_order(
    db: AsyncSession, order_id: uuid.UUID, user_id: uuid.UUID | None = None
) -> OrderOut:
    """Resume a paused order."""
    order = await _get_order_for_update(db, order_id)
    order.is_paused = False
    order.paused_at = None
    # Revert to preparing
    order.status = "preparing"

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status="paused",
            new_status="preparing",
            changed_by_user_id=user_id,
            notes="Order resumed by kitchen.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(*_order_select_options())
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())
