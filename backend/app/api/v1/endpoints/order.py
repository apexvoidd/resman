"""
API Endpoints for Customer Cart Order Placement, Order History, Editing, and Cancellation.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.order import OrderCreate, OrderOut, OrderUpdate
from app.services import order as order_service
from app.services.guest import get_or_create_guest_session

router = APIRouter(prefix="/orders", tags=["Customer Cart & Ordering"])


@router.post(
    "",
    response_model=OrderOut,
    summary="Place a new order from cart",
    status_code=status.HTTP_201_CREATED,
)
async def place_order(
    payload: OrderCreate,
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Place a new customer order for an active, verified dining session.
    Calculates subtotal & taxes, generates unique order number, and creates order items atomically.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await order_service.create_customer_order(db, session, payload)


@router.get(
    "/session",
    response_model=list[OrderOut],
    summary="List all orders placed in the current dining session",
    status_code=status.HTTP_200_OK,
)
async def get_session_orders(
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Fetch active and past orders from the current dining session."""
    if x_session_token:
        from sqlalchemy import select

        from app.models.customer import GuestSession

        res = await db.execute(
            select(GuestSession).where(GuestSession.session_token == x_session_token)
        )
        session = res.scalar_one_or_none()
        if session:
            return await order_service.get_session_orders(db, session)
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await order_service.get_session_orders(db, session)


@router.put(
    "/{order_id}",
    response_model=OrderOut,
    summary="Edit an order (Pending Kitchen Acceptance only)",
    status_code=status.HTTP_200_OK,
)
async def update_order(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Edit order items or instructions.
    Allowed ONLY while order status is 'pending' (Pending Kitchen Acceptance).
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await order_service.update_customer_order(db, session, order_id, payload)


@router.post(
    "/{order_id}/cancel",
    response_model=OrderOut,
    summary="Cancel an order (Pending Kitchen Acceptance only)",
    status_code=status.HTTP_200_OK,
)
async def cancel_order(
    order_id: uuid.UUID,
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Cancel an order.
    Allowed ONLY while order status is 'pending' (Pending Kitchen Acceptance).
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await order_service.cancel_customer_order(db, session, order_id)
