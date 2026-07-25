"""
Staff Management service layer for DB operations.
"""

import math
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.staff import Role, User, UserRole
from app.schemas.staff import (
    RoleOut,
    StaffCreate,
    StaffListResponse,
    StaffOut,
    StaffUpdate,
)


def _build_staff_out(user: User) -> StaffOut:
    """Helper to convert User model with loaded roles into StaffOut DTO."""
    roles = []
    if hasattr(user, "user_roles") and user.user_roles:
        # Extract unique roles
        seen_role_ids = set()
        for ur in user.user_roles:
            if ur.role and ur.role.id not in seen_role_ids:
                seen_role_ids.add(ur.role.id)
                roles.append(
                    RoleOut(
                        id=ur.role.id,
                        name=ur.role.name,
                        code=ur.role.code,
                        description=ur.role.description,
                    )
                )

    return StaffOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_active=user.is_active,
        clerk_user_id=user.clerk_user_id,
        roles=roles,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def get_staff_list(
    db: AsyncSession,
    *,
    search: str | None = None,
    role_code: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 10,
) -> StaffListResponse:
    """
    Fetch paginated staff members with search and filter parameters.
    Only non-deleted staff (`deleted_at is None`) are returned.
    """
    query = (
        select(User)
        .where(User.deleted_at.is_(None))
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
    )

    # Apply search filter (name or email)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                func.concat(User.first_name, " ", User.last_name).ilike(term),
            )
        )

    # Apply role filter
    if role_code and role_code.strip():
        query = query.join(User.user_roles).join(UserRole.role).where(Role.code == role_code.strip())

    # Apply active status filter
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))

    # Count total records matching criteria
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().unique().all()

    items = [_build_staff_out(u) for u in users]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return StaffListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_staff_by_id(db: AsyncSession, staff_id: uuid.UUID) -> StaffOut:
    """Fetch single staff member by UUID."""
    result = await db.execute(
        select(User)
        .where(User.id == staff_id, User.deleted_at.is_(None))
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with ID '{staff_id}' not found.",
        )
    return _build_staff_out(user)


async def create_staff(db: AsyncSession, payload: StaffCreate) -> StaffOut:
    """
    Create a new staff user and assign specified roles.
    Checks for duplicate email address and raises 409 Conflict if found.
    """
    # 1. Check duplicate email
    existing = await db.execute(
        select(User).where(User.email.ilike(payload.email))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A staff member with email '{payload.email}' already exists.",
        )

    # 2. Validate roles exist
    roles_result = await db.execute(
        select(Role).where(Role.code.in_(payload.role_codes))
    )
    roles = roles_result.scalars().all()
    if len(roles) != len(set(payload.role_codes)):
        found_codes = {r.code for r in roles}
        missing = set(payload.role_codes) - found_codes
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role code(s): {', '.join(missing)}",
        )

    # 3. Create User record
    user = User(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        is_active=payload.is_active,
        is_superadmin=False,
    )
    db.add(user)
    await db.flush()  # assign user.id

    # 4. Assign UserRole relations
    for role in roles:
        user_role = UserRole(user_id=user.id, role_id=role.id, branch_id=None)
        db.add(user_role)

    await db.commit()

    # Re-query user with eager loaded relationships
    return await get_staff_by_id(db, user.id)


async def update_staff(
    db: AsyncSession, staff_id: uuid.UUID, payload: StaffUpdate
) -> StaffOut:
    """Update existing staff member details and/or roles."""
    result = await db.execute(
        select(User)
        .where(User.id == staff_id, User.deleted_at.is_(None))
        .options(selectinload(User.user_roles))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with ID '{staff_id}' not found.",
        )

    # Check email duplicate if changing email
    if payload.email and payload.email.lower() != user.email.lower():
        existing = await db.execute(
            select(User).where(
                User.email.ilike(payload.email), User.id != staff_id
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A staff member with email '{payload.email}' already exists.",
            )
        user.email = payload.email

    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_active is not None:
        user.is_active = payload.is_active

    # Update roles if specified
    if payload.role_codes is not None:
        roles_result = await db.execute(
            select(Role).where(Role.code.in_(payload.role_codes))
        )
        roles = roles_result.scalars().all()
        if len(roles) != len(set(payload.role_codes)):
            found_codes = {r.code for r in roles}
            missing = set(payload.role_codes) - found_codes
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role code(s): {', '.join(missing)}",
            )

        # Delete existing user roles
        for ur in list(user.user_roles):
            await db.delete(ur)
        await db.flush()

        # Add new user roles
        for role in roles:
            db.add(UserRole(user_id=user.id, role_id=role.id, branch_id=None))

    await db.commit()
    return await get_staff_by_id(db, staff_id)


async def toggle_staff_status(
    db: AsyncSession, staff_id: uuid.UUID, is_active: bool
) -> StaffOut:
    """Enable or disable a staff member's active status."""
    result = await db.execute(
        select(User).where(User.id == staff_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with ID '{staff_id}' not found.",
        )

    user.is_active = is_active
    await db.commit()
    return await get_staff_by_id(db, staff_id)


async def delete_staff(db: AsyncSession, staff_id: uuid.UUID) -> None:
    """Soft delete a staff member by setting deleted_at timestamp and deactivating."""
    result = await db.execute(
        select(User).where(User.id == staff_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with ID '{staff_id}' not found.",
        )

    user.deleted_at = datetime.now(UTC)
    user.is_active = False
    await db.commit()


async def list_all_roles(db: AsyncSession) -> list[RoleOut]:
    """Fetch all available RBAC roles."""
    result = await db.execute(select(Role).order_by(Role.name.asc()))
    roles = result.scalars().all()
    return [RoleOut.model_validate(r) for r in roles]
