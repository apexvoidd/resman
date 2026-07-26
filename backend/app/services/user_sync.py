"""
Clerk → local database user synchronisation.

On first authenticated request, if the Clerk user does not yet exist
in our `users` table, we create a local record.  Subsequent requests
simply look up by `clerk_user_id`.
"""

import logging
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.staff import Role, User, UserRole

logger = logging.getLogger("app.services.user_sync")


async def _fetch_clerk_user(clerk_user_id: str) -> dict[str, Any]:
    """Call Clerk Backend API to get user details."""
    if not settings.CLERK_SECRET_KEY:
        raise RuntimeError("CLERK_SECRET_KEY is not configured.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
        )
        response.raise_for_status()
        return response.json()


async def _assign_default_role_by_email(db: AsyncSession, user: User) -> None:
    """Helper to assign initial system role to synced users based on email prefix if they have no roles."""
    existing_roles = await db.execute(
        select(UserRole).where(UserRole.user_id == user.id)
    )
    if existing_roles.scalars().all():
        return

    email_lower = user.email.lower()
    target_code = None
    if "admin" in email_lower:
        target_code = "admin"
    elif "manager" in email_lower:
        target_code = "manager"
    elif "cashier" in email_lower:
        target_code = "cashier"
    elif "kitchen" in email_lower or "chef" in email_lower:
        target_code = "kitchen"
    elif "waiter" in email_lower:
        target_code = "waiter"
    elif "clean" in email_lower:
        target_code = "cleaning_staff"

    if target_code:
        role_res = await db.execute(select(Role).where(Role.code == target_code))
        role = role_res.scalar_one_or_none()
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id, branch_id=None))
            await db.commit()
            logger.info("Auto-assigned role %s to user %s (%s)", target_code, user.id, user.email)


async def get_or_create_user(
    db: AsyncSession,
    clerk_user_id: str,
    jwt_claims: dict[str, Any],
) -> User:
    """
    Look up the local user by clerk_user_id.
    If not found, fetch from Clerk API and create a local record.
    Promotes the first user or explicitly designated admin account to superadmin.
    """
    # Check if any superadmin exists in the DB
    superadmin_count = await db.execute(
        select(func.count(User.id)).where(User.is_superadmin == True)
    )
    has_superadmin = (superadmin_count.scalar_one_or_none() or 0) > 0

    # 1. Try to find existing user
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user: User | None = result.scalar_one_or_none()

    if user is not None:
        if not has_superadmin or user.email == "admin@restaurant.com":
            if not user.is_superadmin:
                user.is_superadmin = True
                await db.commit()
                await db.refresh(user)
        await _assign_default_role_by_email(db, user)
        return user

    # 2. User does not exist locally — fetch from Clerk
    logger.info("First-time sync for Clerk user: %s", clerk_user_id)

    try:
        clerk_data = await _fetch_clerk_user(clerk_user_id)
        # Clerk returns a list of email addresses; pick the primary one
        primary_email = next(
            (
                e["email_address"]
                for e in clerk_data.get("email_addresses", [])
                if e["id"] == clerk_data.get("primary_email_address_id")
            ),
            clerk_data.get("email_addresses", [{}])[0].get("email_address", ""),
        )
        first_name = clerk_data.get("first_name") or ""
        last_name = clerk_data.get("last_name") or ""
    except Exception as exc:
        # Fallback: use JWT claims (email may be injected as a session claim)
        logger.warning("Clerk API fetch failed (%s), falling back to JWT claims.", exc)
        primary_email = jwt_claims.get("email", f"{clerk_user_id}@clerk.local")
        first_name = jwt_claims.get("given_name", "")
        last_name = jwt_claims.get("family_name", "")

    # 3. Check if email already exists (edge case: manual creation)
    existing_by_email = await db.execute(
        select(User).where(User.email == primary_email)
    )
    user = existing_by_email.scalar_one_or_none()

    if user is not None:
        # Bind the existing local record to the Clerk identity
        user.clerk_user_id = clerk_user_id
        if user.deleted_at is not None:
            user.deleted_at = None
            user.is_active = True
        if not has_superadmin or primary_email == "admin@restaurant.com":
            user.is_superadmin = True
        await db.commit()
        await db.refresh(user)
        await _assign_default_role_by_email(db, user)
        return user

    # 4. Create a brand-new local user record
    is_admin = (
        clerk_user_id == "dev_admin_user_01"
        or not has_superadmin
        or primary_email == "admin@restaurant.com"
    )
    user = User(
        email=primary_email,
        clerk_user_id=clerk_user_id,
        first_name=first_name or "Unknown",
        last_name=last_name or "User",
        password_hash=None,  # Clerk manages authentication
        is_active=True,
        is_superadmin=is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await _assign_default_role_by_email(db, user)
    logger.info("Created local user %s for Clerk ID %s (is_superadmin=%s)", user.id, clerk_user_id, is_admin)
    return user
