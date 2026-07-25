"""
Auth endpoints:
  GET /me             — returns the authenticated user's profile
  GET /users/me/roles — returns the authenticated user's assigned roles & permissions
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.staff import Role, RolePermission, User, UserRole

router = APIRouter()


# ─── Response schemas ────────────────────────────────────────────────────────


class PermissionOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    module: str

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None = None

    model_config = {"from_attributes": True}


class RoleWithPermissionsOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None = None
    permissions: list[PermissionOut] = []

    model_config = {"from_attributes": True}


class UserMeOut(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    is_active: bool
    is_superadmin: bool
    clerk_user_id: str | None = None

    model_config = {"from_attributes": True}


class UserRolesOut(BaseModel):
    user_id: uuid.UUID
    is_superadmin: bool
    roles: list[RoleWithPermissionsOut] = []

    model_config = {"from_attributes": True}


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/me", response_model=UserMeOut, summary="Get authenticated user profile")
async def get_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Returns the profile of the currently authenticated user."""
    return current_user


@router.get(
    "/users/me/roles",
    response_model=UserRolesOut,
    summary="Get authenticated user's roles and permissions",
)
async def get_my_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns all roles assigned to the authenticated user, along with
    the permissions granted by each role.
    """
    # Fetch user_roles with eagerly loaded role → role_permissions → permission
    result = await db.execute(
        select(UserRole)
        .where(UserRole.user_id == current_user.id)
        .options(
            selectinload(UserRole.role).selectinload(Role.role_permissions).selectinload(
                RolePermission.permission
            )
        )
    )
    user_roles = result.scalars().all()

    roles_out: list[RoleWithPermissionsOut] = []
    for ur in user_roles:
        role = ur.role
        permissions = [
            PermissionOut(
                id=rp.permission.id,
                name=rp.permission.name,
                code=rp.permission.code,
                module=rp.permission.module,
            )
            for rp in role.role_permissions
        ]
        roles_out.append(
            RoleWithPermissionsOut(
                id=role.id,
                name=role.name,
                code=role.code,
                description=role.description,
                permissions=permissions,
            )
        )

    return UserRolesOut(
        user_id=current_user.id,
        is_superadmin=current_user.is_superadmin,
        roles=roles_out,
    )
