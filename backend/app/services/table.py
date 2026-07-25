"""
Table Management service layer for DB operations.
"""

import math
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Branch, Restaurant
from app.models.table import DiningTable
from app.schemas.table import (
    TableCreate,
    TableListResponse,
    TableOut,
    TableUpdate,
)


def _build_table_out(table: DiningTable) -> TableOut:
    """Map DiningTable ORM model to TableOut DTO."""
    return TableOut(
        id=table.id,
        branch_id=table.branch_id,
        table_number=table.table_number,
        capacity=table.capacity,
        status=table.status,
        description=table.location_description,
        is_active=table.is_active,
        created_at=table.created_at,
        updated_at=table.updated_at,
    )


async def get_or_create_default_branch(db: AsyncSession) -> Branch:
    """
    Returns the first active branch, creating a default restaurant and branch
    if none exists yet.
    """
    result = await db.execute(
        select(Branch).where(Branch.is_active.is_(True)).limit(1)
    )
    branch = result.scalar_one_or_none()
    if branch is not None:
        return branch

    # Check if a restaurant exists
    res_result = await db.execute(
        select(Restaurant).where(Restaurant.is_active.is_(True)).limit(1)
    )
    restaurant = res_result.scalar_one_or_none()
    if restaurant is None:
        restaurant = Restaurant(
            name="Main Restaurant",
            currency="INR",
            timezone="Asia/Kolkata",
            is_active=True,
        )
        db.add(restaurant)
        await db.flush()

    branch = Branch(
        restaurant_id=restaurant.id,
        name="Main Branch",
        is_active=True,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def get_table_list(
    db: AsyncSession,
    *,
    search: str | None = None,
    table_status: str | None = None,
    min_capacity: int | None = None,
    exact_capacity: int | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 10,
) -> TableListResponse:
    """
    Fetch paginated dining tables with search and status/capacity filters.
    Only non-deleted tables (`deleted_at is None`) are returned.
    """
    branch = await get_or_create_default_branch(db)

    query = select(DiningTable).where(
        DiningTable.branch_id == branch.id,
        DiningTable.deleted_at.is_(None),
    )

    # Search by table number
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(DiningTable.table_number.ilike(term))

    # Filter by status
    if table_status and table_status.strip():
        query = query.where(DiningTable.status == table_status.strip())

    # Filter by capacity
    if exact_capacity is not None:
        query = query.where(DiningTable.capacity == exact_capacity)
    elif min_capacity is not None:
        query = query.where(DiningTable.capacity >= min_capacity)

    # Filter by active state
    if is_active is not None:
        query = query.where(DiningTable.is_active.is_(is_active))

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    query = query.order_by(DiningTable.table_number.asc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    tables = result.scalars().all()

    items = [_build_table_out(t) for t in tables]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return TableListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_table_by_id(db: AsyncSession, table_id: uuid.UUID) -> TableOut:
    """Fetch single dining table by UUID."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )
    return _build_table_out(table)


async def create_table(db: AsyncSession, payload: TableCreate) -> TableOut:
    """
    Create a new dining table.
    Checks for duplicate table number within the branch and raises 409 Conflict if found.
    """
    branch = await get_or_create_default_branch(db)

    # Check duplicate table_number in branch
    existing = await db.execute(
        select(DiningTable).where(
            DiningTable.branch_id == branch.id,
            DiningTable.table_number.ilike(payload.table_number),
            DiningTable.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Table number '{payload.table_number}' already exists.",
        )

    table = DiningTable(
        branch_id=branch.id,
        table_number=payload.table_number,
        capacity=payload.capacity,
        status=payload.status,
        location_description=payload.description,
        is_active=payload.is_active,
        qr_identifier=f"qr_{uuid.uuid4().hex}",
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)

    return _build_table_out(table)


async def update_table(
    db: AsyncSession, table_id: uuid.UUID, payload: TableUpdate
) -> TableOut:
    """Update an existing dining table's details."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    # Check duplicate table_number if being updated
    if (
        payload.table_number
        and payload.table_number.lower() != table.table_number.lower()
    ):
        existing = await db.execute(
            select(DiningTable).where(
                DiningTable.branch_id == table.branch_id,
                DiningTable.table_number.ilike(payload.table_number),
                DiningTable.id != table_id,
                DiningTable.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Table number '{payload.table_number}' already exists.",
            )
        table.table_number = payload.table_number

    if payload.capacity is not None:
        table.capacity = payload.capacity
    if payload.status is not None:
        table.status = payload.status
    if payload.description is not None:
        table.location_description = payload.description
    if payload.is_active is not None:
        table.is_active = payload.is_active

    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)


async def toggle_table_status(
    db: AsyncSession,
    table_id: uuid.UUID,
    *,
    is_active: bool | None = None,
    table_status: str | None = None,
) -> TableOut:
    """Toggle table active status or update table operational status."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    if is_active is not None:
        table.is_active = is_active
        if not is_active:
            table.status = "out_of_service"

    if table_status is not None:
        table.status = table_status

    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)


async def delete_table(db: AsyncSession, table_id: uuid.UUID) -> None:
    """Soft delete a dining table by setting deleted_at timestamp."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    table.deleted_at = datetime.now(UTC)
    table.is_active = False
    table.status = "out_of_service"
    await db.commit()
