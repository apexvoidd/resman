"""
Restaurant Settings API

Routes:
    GET  /settings          — returns current settings (any authenticated user)
    PUT  /settings          — updates settings (admin only)
    POST /settings/logo     — uploads logo to R2 (admin only)
"""

from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.settings import (
    LogoUploadOut,
    RestaurantSettingsOut,
    RestaurantSettingsUpdate,
)
from app.services import r2 as r2_service
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "",
    response_model=RestaurantSettingsOut,
    summary="Get restaurant settings",
    status_code=status.HTTP_200_OK,
)
async def get_settings(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns the combined restaurant profile + operational settings."""
    return await settings_service.get_settings(db)


@router.put(
    "",
    response_model=RestaurantSettingsOut,
    summary="Update restaurant settings (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def update_settings(
    payload: RestaurantSettingsUpdate,
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Partially updates restaurant settings.
    Only fields included in the request body are modified.
    Requires the **admin** role.
    """
    return await settings_service.update_settings(db, payload)


@router.post(
    "/logo",
    response_model=LogoUploadOut,
    summary="Upload restaurant logo to Cloudflare R2 (Admin only)",
    status_code=status.HTTP_200_OK,
)
async def upload_logo(
    file: UploadFile = File(
        ..., description="Logo image (JPEG / PNG / WebP / GIF, max 5 MB)"
    ),
    _: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Uploads a logo image to Cloudflare R2 and saves the resulting URL on the
    restaurant record.  Returns the public URL.

    Requires the **admin** role and R2 storage to be configured.
    """
    logo_url = await r2_service.upload_logo(file)

    # Persist the new logo_url without changing any other settings field
    empty_payload = RestaurantSettingsUpdate()
    await settings_service.update_settings(db, empty_payload, logo_url=logo_url)

    return LogoUploadOut(logo_url=logo_url)
