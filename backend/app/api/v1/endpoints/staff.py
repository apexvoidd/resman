"""
Staff Management API

All endpoints in this router require Admin role permissions.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.staff import (
    RoleOut,
    StaffCreate,
    StaffListResponse,
    StaffOut,
    StaffStatusToggle,
    StaffUpdate,
)
from app.services import staff as staff_service

router = APIRouter(prefix="/staff", tags=["Staff Management"])


@router.get(
    "",
    response_model=StaffListResponse,
    summary="List staff members with search and filters (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def list_staff(
    search: str | None = Query(
        None, description="Search by staff name or email address"
    ),
    role: str | None = Query(None, description="Filter by role code (e.g. waiter)"),
    is_active: bool | None = Query(
        None, description="Filter by active status (true/false)"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Retrieve paginated staff members.
    Supports filtering by search query (name/email), role code, and active status.
    """
    return await staff_service.get_staff_list(
        db,
        search=search,
        role_code=role,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/roles",
    response_model=list[RoleOut],
    summary="List available system roles (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def list_roles(
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns list of system RBAC roles for assignable staff options."""
    return await staff_service.list_all_roles(db)


@router.get(
    "/{staff_id}",
    response_model=StaffOut,
    summary="Get staff member details (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def get_staff(
    staff_id: uuid.UUID,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve details for a single staff member by UUID."""
    return await staff_service.get_staff_by_id(db, staff_id)


@router.post(
    "",
    response_model=StaffOut,
    summary="Create a new staff member (Admin only)",
    status_code=status.HTTP_201_CREATED,
)
async def create_staff(
    payload: StaffCreate,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new staff member and assign roles.
    Checks for duplicate emails and returns 409 Conflict if found.
    """
    return await staff_service.create_staff(db, payload)


@router.put(
    "/{staff_id}",
    response_model=StaffOut,
    summary="Update staff member details and roles (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdate,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update existing staff member profile or assigned roles."""
    return await staff_service.update_staff(db, staff_id, payload)


@router.patch(
    "/{staff_id}/status",
    response_model=StaffOut,
    summary="Enable/Disable staff member active status (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def toggle_staff_status(
    staff_id: uuid.UUID,
    payload: StaffStatusToggle,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Toggle staff member active status between Active and Inactive."""
    return await staff_service.toggle_staff_status(db, staff_id, payload.is_active)


@router.delete(
    "/{staff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete a staff member (Admin only)",
)
async def delete_staff(
    staff_id: uuid.UUID,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a staff member (sets deleted_at and deactivates)."""
    await staff_service.delete_staff(db, staff_id)
