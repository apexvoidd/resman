"""
Service layer for Customer Cart Order Creation, Order Modifications, Cancellation,
and Session Order History.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import GuestSession
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.recipe import Ingredient, Recipe, RecipeIngredient
from app.models.table import DiningTable
from app.schemas.order import (
    OrderCreate,
    OrderItemOut,
    OrderOut,
    OrderUpdate,
)

logger = logging.getLogger("app.services.order")

TAX_RATE = 0.05  # 5% default GST tax rate for calculations


def _get_status_message(status_str: str) -> str:
    """Generate user-facing status message."""
    messages = {
        "pending": "Pending Kitchen Acceptance",
        "confirmed": "Your order is already being prepared.",
        "preparing": "Your order is already being prepared.",
        "ready": "Order is ready for serving!",
        "served": "Order served.",
        "completed": "Order completed.",
        "cancelled": "Order cancelled.",
    }
    return messages.get(status_str, "Order in progress.")


def _build_order_out(order: Order) -> OrderOut:
    """Map Order ORM model to OrderOut DTO."""
    can_edit_cancel = order.status == "pending"

    item_dtos: list[OrderItemOut] = []
    for item in order.items:
        item_name = item.menu_item.name if item.menu_item else "Dish"
        item_dtos.append(
            OrderItemOut(
                id=item.id,
                menu_item_id=item.menu_item_id,
                menu_item_name=item_name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                total_price=float(item.total_price),
                special_instructions=item.notes,
            )
        )

    table_num = None
    try:
        if order.table:
            table_num = order.table.table_number
    except Exception:
        pass

    guest_cnt = None
    try:
        if order.guest_session:
            guest_cnt = order.guest_session.guest_count
    except Exception:
        pass

    now = datetime.now(UTC)
    created_at_dt = order.created_at
    if created_at_dt.tzinfo is None:
        created_at_dt = created_at_dt.replace(tzinfo=UTC)

    elapsed_sec = int((now - created_at_dt).total_seconds()) if created_at_dt else 0

    is_delayed = False
    if order.estimated_completion_at:
        est_comp = order.estimated_completion_at
        if est_comp.tzinfo is None:
            est_comp = est_comp.replace(tzinfo=UTC)
        if now > est_comp and order.status not in ["completed", "served", "cancelled"]:
            is_delayed = True

    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        priority=order.priority,
        estimated_prep_minutes=order.estimated_prep_minutes,
        estimated_completion_at=order.estimated_completion_at,
        elapsed_seconds=elapsed_sec,
        is_delayed=is_delayed,
        is_paused=order.is_paused,
        paused_at=order.paused_at,
        table_id=order.table_id,
        table_number=table_num,
        guest_count=guest_cnt,
        total_amount=float(order.total_amount),
        tax_amount=float(order.tax_amount),
        discount_amount=float(order.discount_amount),
        final_amount=float(order.final_amount),
        notes=order.notes,
        items=item_dtos,
        can_edit=can_edit_cancel,
        can_cancel=can_edit_cancel,
        status_message=_get_status_message(order.status),
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


async def create_customer_order(
    db: AsyncSession, session: GuestSession, payload: OrderCreate
) -> OrderOut:
    """
    Create a new customer order for an active, verified dining session.
    1. Validates session is verified and seated.
    2. Prevents duplicate submissions within 5 seconds.
    3. Validates item availability and positive quantities.
    4. Creates order and line items atomically.
    """
    now = datetime.now(UTC)

    # 0. Check if restaurant is closed
    from app.services.settings import get_first_restaurant

    restaurant = await get_first_restaurant(db)
    if restaurant.settings and restaurant.settings.is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Restaurant is currently closed for ordering.",
        )

    # 1. Prerequisite Checks: Session must be active, assigned to table, and verified
    if not session.is_active or not session.table_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active dining session with assigned table required to place orders.",
        )

    if getattr(session, "is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dining session is locked for billing. No new orders permitted.",
        )

    # Check table status / verification status
    tbl_res = await db.execute(
        select(DiningTable).where(DiningTable.id == session.table_id)
    )
    table = tbl_res.scalar_one_or_none()

    if not table or (
        session.verification_status != "confirmed" and table.status != "occupied"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Arrival verification required before placing orders. Please notify staff at your table.",
        )

    # 2. Prevent Duplicate Order Submissions (Idempotency / 5-second check)
    recent_check = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
        )
        .where(
            Order.guest_session_id == session.id,
            Order.status == "pending",
            Order.created_at >= now - timedelta(seconds=5),
        )
        .order_by(Order.created_at.desc())
    )
    recent_order = recent_check.scalar_one_or_none()
    if recent_order:
        logger.info(
            "Duplicate order submission prevented for session %s", session.session_token
        )
        return _build_order_out(recent_order)

    # 3. Validate Menu Items, Availability & Ingredient Portion Stock
    subtotal = 0.0
    order_items_data = []
    required_ingredients: dict[UUID, float] = {}
    item_ingredient_map: list[tuple[MenuItem, int]] = []

    for item_in in payload.items:
        if item_in.quantity < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item quantities must be positive integers.",
            )

        menu_res = await db.execute(
            select(MenuItem)
            .options(
                selectinload(MenuItem.recipes)
                .selectinload(Recipe.recipe_ingredients)
                .selectinload(RecipeIngredient.ingredient)
            )
            .where(MenuItem.id == item_in.menu_item_id, MenuItem.deleted_at.is_(None))
        )
        menu_item = menu_res.scalar_one_or_none()
        if not menu_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item '{item_in.menu_item_id}' not found.",
            )

        if not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item '{menu_item.name}' is currently unavailable for ordering.",
            )

        # Aggregate required ingredients for recipe validation
        if menu_item.recipes:
            rec = menu_item.recipes[0]
            for ri in rec.recipe_ingredients:
                needed = float(ri.quantity) * item_in.quantity
                required_ingredients[ri.ingredient_id] = (
                    required_ingredients.get(ri.ingredient_id, 0.0) + needed
                )

        item_ingredient_map.append((menu_item, item_in.quantity))

        unit_p = float(menu_item.price)
        item_total = round(unit_p * item_in.quantity, 2)
        subtotal += item_total

        order_items_data.append(
            {
                "menu_item_id": menu_item.id,
                "quantity": item_in.quantity,
                "unit_price": unit_p,
                "total_price": item_total,
                "notes": item_in.special_instructions,
            }
        )

    # Validate ingredient stock sufficiency across all items in the order
    for ing_id, total_needed in required_ingredients.items():
        ing_res = await db.execute(select(Ingredient).where(Ingredient.id == ing_id))
        ing_obj = ing_res.scalar_one_or_none()
        if ing_obj:
            cur_stock = float(ing_obj.current_stock)
            if cur_stock < total_needed:
                for m_item, req_qty in item_ingredient_map:
                    if m_item.recipes:
                        rec = m_item.recipes[0]
                        for ri in rec.recipe_ingredients:
                            if ri.ingredient_id == ing_id:
                                single_req = float(ri.quantity)
                                max_portions = (
                                    int(cur_stock // single_req)
                                    if single_req > 0
                                    else 0
                                )
                                if max_portions == 0:
                                    detail_msg = f"Cannot order '{m_item.name}'. Ingredient '{ing_obj.name}' is currently out of stock."
                                else:
                                    detail_msg = f"Cannot order {req_qty}x '{m_item.name}'. Only {max_portions} portion(s) available based on current '{ing_obj.name}' stock."
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=detail_msg,
                                )

    # 4. Atomic Transaction Creation
    tax_pct = float(restaurant.settings.tax_percentage) if restaurant and restaurant.settings else 5.0
    tax_amt = round(subtotal * (tax_pct / 100.0), 2)
    final_amt = round(subtotal + tax_amt, 2)
    order_num = f"ORD-{now.strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    new_order = Order(
        branch_id=session.branch_id or table.branch_id,
        table_id=table.id,
        customer_id=session.customer_id,
        guest_session_id=session.id,
        order_number=order_num,
        order_type="dine_in",
        status="pending",
        total_amount=subtotal,
        tax_amount=tax_amt,
        discount_amount=0.0,
        final_amount=final_amt,
        notes=payload.notes,
    )
    db.add(new_order)
    await db.flush()

    for item_dict in order_items_data:
        db.add(
            OrderItem(
                order_id=new_order.id,
                menu_item_id=item_dict["menu_item_id"],
                quantity=item_dict["quantity"],
                unit_price=item_dict["unit_price"],
                total_price=item_dict["total_price"],
                status="pending",
                notes=item_dict["notes"],
            )
        )

    db.add(
        OrderStatusHistory(
            order_id=new_order.id,
            previous_status=None,
            new_status="pending",
            notes="Customer submitted order via digital menu.",
        )
    )

    await db.commit()

    # Re-query order with relationships loaded
    final_res = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
        )
        .where(Order.id == new_order.id)
    )
    created_order = final_res.scalar_one()
    return _build_order_out(created_order)


async def get_session_orders(db: AsyncSession, session: GuestSession) -> list[OrderOut]:
    """Fetch all orders placed in the current dining session."""
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
        )
        .where(
            Order.guest_session_id == session.id,
            Order.deleted_at.is_(None),
        )
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_build_order_out(o) for o in orders]


async def update_customer_order(
    db: AsyncSession, session: GuestSession, order_id: UUID, payload: OrderUpdate
) -> OrderOut:
    """
    Customer edits an order.
    ONLY allowed when order status is 'pending' (Pending Kitchen Acceptance).
    """
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(
            Order.id == order_id,
            Order.guest_session_id == session.id,
            Order.deleted_at.is_(None),
        )
        .with_for_update()
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found for current session.",
        )

    if order.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your order is already being prepared and can no longer be edited.",
        )

    # Delete existing items
    for old_item in order.items:
        await db.delete(old_item)
    await db.flush()

    subtotal = 0.0
    for item_in in payload.items:
        if item_in.quantity < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item quantities must be positive integers.",
            )

        menu_res = await db.execute(
            select(MenuItem).where(
                MenuItem.id == item_in.menu_item_id, MenuItem.deleted_at.is_(None)
            )
        )
        menu_item = menu_res.scalar_one_or_none()
        if not menu_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item '{item_in.menu_item_id}' not found.",
            )

        if not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item '{menu_item.name}' is currently unavailable.",
            )

        unit_p = float(menu_item.price)
        item_total = round(unit_p * item_in.quantity, 2)
        subtotal += item_total

        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                quantity=item_in.quantity,
                unit_price=unit_p,
                total_price=item_total,
                status="pending",
                notes=item_in.special_instructions,
            )
        )

    tax_amt = round(subtotal * TAX_RATE, 2)
    final_amt = round(subtotal + tax_amt, 2)

    order.total_amount = subtotal
    order.tax_amount = tax_amt
    order.final_amount = final_amt
    if payload.notes is not None:
        order.notes = payload.notes

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status="pending",
            new_status="pending",
            notes="Customer updated order items.",
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
        )
        .where(Order.id == order.id)
    )
    return _build_order_out(final_res.scalar_one())


async def cancel_customer_order(
    db: AsyncSession, session: GuestSession, order_id: UUID
) -> OrderOut:
    """
    Customer cancels an order.
    ONLY allowed when order status is 'pending'.
    """
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
        )
        .where(
            Order.id == order_id,
            Order.guest_session_id == session.id,
            Order.deleted_at.is_(None),
        )
        .with_for_update()
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found for current session.",
        )

    if order.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your order is already being prepared and can no longer be cancelled.",
        )

    prev_st = order.status
    order.status = "cancelled"

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            previous_status=prev_st,
            new_status="cancelled",
            notes="Customer cancelled pending order.",
        )
    )

    await db.commit()
    await db.refresh(order)
    return _build_order_out(order)
