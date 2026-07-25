"""
Clerk → local database user synchronisation.

On first authenticated request, if the Clerk user does not yet exist
in our `users` table, we create a local record.  Subsequent requests
simply look up by `clerk_user_id`.
"""

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.staff import User

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


async def get_or_create_user(
    db: AsyncSession,
    clerk_user_id: str,
    jwt_claims: dict[str, Any],
) -> User:
    """
    Look up the local user by clerk_user_id.
    If not found, fetch from Clerk API and create a local record.
    """
    # 1. Try to find existing user
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user: User | None = result.scalar_one_or_none()

    if user is not None:
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
        await db.commit()
        await db.refresh(user)
        return user

    # 4. Create a brand-new local user record
    user = User(
        email=primary_email,
        clerk_user_id=clerk_user_id,
        first_name=first_name or "Unknown",
        last_name=last_name or "User",
        password_hash=None,  # Clerk manages authentication
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Created local user %s for Clerk ID %s", user.id, clerk_user_id)
    return user
