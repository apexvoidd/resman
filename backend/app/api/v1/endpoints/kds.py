"""
API Endpoints for Kitchen Display System (KDS) Workflow and Order State Management.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.order import (
    AcceptOrderInput,
    OrderOut,
    PauseOrderInput,
    UpdatePrepTimeInput,
    UpdatePriorityInput,
)
from app.services import kds as kds_service

router = APIRouter(prefix="/kds", tags=["Kitchen Display System (KDS)"])


@router.get(
    "/orders",
    response_model=list[OrderOut],
    summary="Get active KDS order cards for kitchen dashboard",
    status_code=status.HTTP_200_OK,
)
async def get_kds_orders(
    search: str | None = Query(None, description="Search by order number"),
    status: str | None = Query(
        None,
        description="Filter by status (pending, accepted, preparing, ready, paused, completed, everything=all including completed)",
    ),
    sort_by: str | None = Query(
        "oldest", description="Sort by: oldest, newest, longest_waiting"
    ),
    _: User = Depends(
        require_role(
            [
                "waiter",
                "cashier",
                "kitchen",
                "kitchen_staff",
                "chef",
                "manager",
                "admin",
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve active kitchen orders cards with search, filtering, and sorting."""
    return await kds_service.get_kds_active_orders(
        db, search=search, status_filter=status, sort_by=sort_by
    )


@router.get(
    "/waiter-orders",
    response_model=list[OrderOut],
    summary="Get orders for waiter dashboard (active + completed-unbilled)",
    status_code=status.HTTP_200_OK,
)
async def get_waiter_orders(
    _: User = Depends(require_role(["waiter", "cashier", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Fetch orders for waiter dashboard.
    Returns active orders + completed orders that don't yet have a paid bill.
    Disappears from dashboard once bill is paid.
    """
    return await kds_service.get_waiter_active_orders(db)


@router.post(
    "/orders/{order_id}/accept",
    response_model=OrderOut,
    summary="Accept order and set estimated prep time",
    status_code=status.HTTP_200_OK,
)
async def accept_order(
    order_id: uuid.UUID,
    payload: AcceptOrderInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Accept pending order and set estimated prep time in minutes."""
    return await kds_service.accept_order(
        db, order_id, payload.estimated_prep_minutes, current_user.id
    )


@router.post(
    "/orders/{order_id}/preparing",
    response_model=OrderOut,
    summary="Start order preparation",
    status_code=status.HTTP_200_OK,
)
async def start_preparing(
    order_id: uuid.UUID,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Transition order status to preparing."""
    return await kds_service.start_preparing(db, order_id, current_user.id)


@router.post(
    "/orders/{order_id}/ready",
    response_model=OrderOut,
    summary="Mark order ready for serving",
    status_code=status.HTTP_200_OK,
)
async def mark_order_ready(
    order_id: uuid.UUID,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Mark order ready and send real-time notification to waiters."""
    return await kds_service.mark_order_ready(db, order_id, current_user.id)


@router.post(
    "/orders/{order_id}/complete",
    response_model=OrderOut,
    summary="Mark order as completed/served",
    status_code=status.HTTP_200_OK,
)
async def mark_order_completed(
    order_id: uuid.UUID,
    current_user: User = Depends(
        require_role(
            [
                "waiter",
                "cashier",
                "kitchen",
                "kitchen_staff",
                "chef",
                "manager",
                "admin",
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Mark order as completed."""
    return await kds_service.mark_order_completed(db, order_id, current_user.id)


@router.patch(
    "/orders/{order_id}/prep-time",
    response_model=OrderOut,
    summary="Update estimated preparation time",
    status_code=status.HTTP_200_OK,
)
async def update_prep_time(
    order_id: uuid.UUID,
    payload: UpdatePrepTimeInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update estimated prep time in minutes."""
    return await kds_service.update_prep_time(
        db, order_id, payload.estimated_prep_minutes, current_user.id
    )


@router.patch(
    "/orders/{order_id}/priority",
    response_model=OrderOut,
    summary="Update order priority (Manager only)",
    status_code=status.HTTP_200_OK,
)
async def update_priority(
    order_id: uuid.UUID,
    payload: UpdatePriorityInput,
    current_user: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update order priority (normal, high, urgent). Requires Manager or Admin role."""
    return await kds_service.update_priority(
        db, order_id, payload.priority, current_user.id
    )


@router.post(
    "/orders/{order_id}/pause",
    response_model=OrderOut,
    summary="Pause order preparation",
    status_code=status.HTTP_200_OK,
)
async def pause_order(
    order_id: uuid.UUID,
    payload: PauseOrderInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Pause order preparation."""
    return await kds_service.pause_order(db, order_id, payload.reason, current_user.id)


@router.post(
    "/orders/{order_id}/resume",
    response_model=OrderOut,
    summary="Resume paused order",
    status_code=status.HTTP_200_OK,
)
async def resume_order(
    order_id: uuid.UUID,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Resume order preparation."""
    return await kds_service.resume_order(db, order_id, current_user.id)
