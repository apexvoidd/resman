"""
Table Management API

Write endpoints (Create/Update/Delete/Status) require Admin or Manager roles.
Read endpoints require authentication.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.guest import PendingVerificationTable, VerificationActionInput
from app.schemas.table import (
    TableCreate,
    TableListResponse,
    TableOut,
    TableStatusToggle,
    TableUpdate,
)
from app.services import table as table_service

router = APIRouter(prefix="/tables", tags=["Table Management"])


@router.get(
    "/verification-requests",
    response_model=list[PendingVerificationTable],
    summary="List all tables awaiting arrival verification (Waiters, Managers, Admins)",
    status_code=status.HTTP_200_OK,
)
async def list_verification_requests(
    _: User = Depends(require_role(["waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve all tables in 'awaiting_verification' status for waiter dashboard."""
    return await table_service.get_pending_verifications(db)


@router.post(
    "/{table_id}/verify",
    response_model=TableOut,
    summary="Waiter confirms or rejects customer arrival",
    status_code=status.HTTP_200_OK,
)
async def verify_arrival(
    table_id: uuid.UUID,
    payload: VerificationActionInput,
    current_user: User = Depends(require_role(["waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Confirm or reject customer arrival at assigned table."""
    return await table_service.verify_customer_arrival(
        db, table_id, payload, current_user
    )


@router.get(
    "",
    response_model=TableListResponse,
    summary="List dining tables with search and status/capacity filters",
    status_code=status.HTTP_200_OK,
)
async def list_tables(
    search: str | None = Query(
        None, description="Search by table number"
    ),
    table_status: str | None = Query(
        None,
        alias="status",
        description="Filter by status (available, reserved, occupied, billing, cleaning, out_of_service)",
    ),
    min_capacity: int | None = Query(
        None, description="Filter by minimum seat capacity"
    ),
    exact_capacity: int | None = Query(
        None, alias="capacity", description="Filter by exact seat capacity"
    ),
    is_active: bool | None = Query(
        None, description="Filter by active status (true/false)"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Retrieve paginated dining tables.
    Supports filtering by search query (table number), status, capacity, and active state.
    """
    return await table_service.get_table_list(
        db,
        search=search,
        table_status=table_status,
        min_capacity=min_capacity,
        exact_capacity=exact_capacity,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/cleaning-queue",
    summary="Get all tables pending cleaning (status=cleaning)",
    status_code=status.HTTP_200_OK,
)
async def get_cleaning_queue(
    _: User = Depends(require_role(["cleaning_staff", "waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns all tables currently in 'cleaning' status."""
    return await table_service.get_cleaning_queue(db)


@router.get(
    "/{table_id}",
    response_model=TableOut,
    summary="Get table details",
    status_code=status.HTTP_200_OK,
)
async def get_table(
    table_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve details for a single dining table by UUID."""
    return await table_service.get_table_by_id(db, table_id)


@router.post(
    "",
    response_model=TableOut,
    summary="Create a new dining table (Admin & Manager only)",
    status_code=status.HTTP_201_CREATED,
)
async def create_table(
    payload: TableCreate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new dining table.
    Checks for duplicate table numbers and returns 409 Conflict if found.
    Requires Admin or Manager role.
    """
    return await table_service.create_table(db, payload)


@router.put(
    "/{table_id}",
    response_model=TableOut,
    summary="Update dining table details (Admin & Manager only)",
    status_code=status.HTTP_200_OK,
)
async def update_table(
    table_id: uuid.UUID,
    payload: TableUpdate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update dining table attributes (number, capacity, status, description, active).
    Requires Admin or Manager role.
    """
    return await table_service.update_table(db, table_id, payload)


@router.patch(
    "/{table_id}/status",
    response_model=TableOut,
    summary="Enable/Disable table or update status (Admin & Manager only)",
    status_code=status.HTTP_200_OK,
)
async def toggle_table_status(
    table_id: uuid.UUID,
    payload: TableStatusToggle,
    _: User = Depends(require_role(["waiter", "cashier", "kitchen_staff", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update active state or operational status for a dining table."""
    return await table_service.toggle_table_status(
        db, table_id, is_active=payload.is_active, table_status=payload.status
    )


@router.delete(
    "/{table_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete a dining table (Admin & Manager only)",
)
async def delete_table(
    table_id: uuid.UUID,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a dining table."""
    await table_service.delete_table(db, table_id)


@router.post(
    "/{table_id}/mark-clean",
    response_model=TableOut,
    summary="Mark a table as clean and available",
    status_code=status.HTTP_200_OK,
)
async def mark_table_clean(
    table_id: uuid.UUID,
    current_user: User = Depends(require_role(["cleaning_staff", "waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Cleaning staff marks a table as clean, setting status back to available."""
    return await table_service.mark_table_clean(db, table_id, current_user)
