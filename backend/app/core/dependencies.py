"""
FastAPI injectable dependencies for authentication and RBAC.

Usage in endpoints:

    @router.get("/secure")
    async def secure_route(user: User = Depends(get_current_user)):
        ...

    @router.get("/admin-only")
    async def admin_route(
        user: User = Depends(require_role(["admin"]))
    ):
        ...
"""

import logging
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import verify_clerk_token
from app.db.session import get_db
from app.models.staff import Permission, Role, User, UserRole
from app.services.user_sync import get_or_create_user

logger = logging.getLogger("app.dependencies")

_bearer = HTTPBearer(auto_error=False)


async def _extract_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Extract and verify the Bearer token from the Authorization header."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_clerk_token(credentials.credentials)


async def get_current_user(
    claims: dict[str, Any] = Depends(_extract_claims),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolves the authenticated user from a Clerk JWT.
    Creates a local user record on first login (sync-on-demand).
    """
    clerk_user_id: str = claims.get("sub", "")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the subject claim.",
        )

    user = await get_or_create_user(db, clerk_user_id, claims)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated.",
        )

    return user


async def get_current_user_with_roles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Returns the current user with eagerly loaded roles and permissions."""
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role).selectinload(
                Role.role_permissions
            ).selectinload(Role.role_permissions)  # type: ignore[arg-type]
        )
    )
    return result.scalar_one()


def require_role(role_codes: list[str]) -> Callable:
    """
    Dependency factory that restricts access to users with at least one
    of the specified role codes.

    Example:
        Depends(require_role(["admin", "manager"]))
    """

    async def _check_role(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user.is_superadmin:
            return user

        result = await db.execute(
            select(UserRole)
            .join(Role, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user.id,
                Role.code.in_(role_codes),
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires one of these roles: {role_codes}",
            )
        return user

    return _check_role


def require_permission(permission_code: str) -> Callable:
    """
    Dependency factory that restricts access to users whose roles
    include the specified permission code.

    Example:
        Depends(require_permission("order:view"))
    """

    async def _check_permission(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user.is_superadmin:
            return user

        result = await db.execute(
            select(Permission)
            .join(Permission.role_permissions)
            .join(Role, Role.id == Permission.role_permissions.entity.role_id)  # type: ignore[attr-defined]
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user.id,
                Permission.code == permission_code,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires permission: {permission_code}",
            )
        return user

    return _check_permission
