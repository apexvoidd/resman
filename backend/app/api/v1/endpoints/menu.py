"""
API Endpoints for Category and Menu Item Management, R2 Image Upload, and Public Customer Browsing.
"""

import uuid
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.menu import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    MenuItemCreate,
    MenuItemListResponse,
    MenuItemOut,
    MenuItemUpdate,
)
from app.services import menu as menu_service
from app.services.r2 import upload_file_to_r2

router = APIRouter(prefix="/menu", tags=["Menu & Category Management"])


# --- CATEGORY ENDPOINTS ---

@router.get(
    "/categories",
    response_model=list[CategoryOut],
    summary="List menu categories (Public & Staff)",
    status_code=status.HTTP_200_OK,
)
async def list_categories(
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve all menu categories sorted by display order."""
    return await menu_service.get_category_list(db, is_active=is_active)


@router.post(
    "/categories",
    response_model=CategoryOut,
    summary="Create a new menu category (Admin & Manager)",
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: CategoryCreate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new menu category. Requires Admin or Manager role."""
    return await menu_service.create_category(db, payload)


@router.put(
    "/categories/{category_id}",
    response_model=CategoryOut,
    summary="Edit menu category (Admin & Manager)",
    status_code=status.HTTP_200_OK,
)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update category details. Requires Admin or Manager role."""
    return await menu_service.update_category(db, category_id, payload)


@router.patch(
    "/categories/{category_id}/status",
    response_model=CategoryOut,
    summary="Enable/Disable menu category (Admin & Manager)",
    status_code=status.HTTP_200_OK,
)
async def toggle_category_status(
    category_id: uuid.UUID,
    is_active: bool = Query(..., description="Target active status (true/false)"),
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Toggle category active state. Requires Admin or Manager role."""
    return await menu_service.toggle_category_status(db, category_id, is_active)


# --- MENU ITEM ENDPOINTS ---

@router.get(
    "/items",
    response_model=MenuItemListResponse,
    summary="List menu items with search, category filter, availability, dietary flags, and price sorting",
    status_code=status.HTTP_200_OK,
)
async def list_menu_items(
    search: str | None = Query(None, description="Search by dish name or description"),
    category_id: uuid.UUID | None = Query(None, description="Filter by category ID"),
    is_available: bool | None = Query(None, description="Filter by availability (true/false)"),
    is_vegetarian: bool | None = Query(None, description="Filter vegetarian dishes"),
    is_vegan: bool | None = Query(None, description="Filter vegan dishes"),
    is_jain: bool | None = Query(None, description="Filter Jain dishes"),
    sort_by_price: str | None = Query(None, description="Sort price: 'asc' or 'desc'"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve menu items with filtering and price sorting. Publicly accessible."""
    return await menu_service.get_menu_item_list(
        db,
        search=search,
        category_id=category_id,
        is_available=is_available,
        is_vegetarian=is_vegetarian,
        is_vegan=is_vegan,
        is_jain=is_jain,
        sort_by_price=sort_by_price,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/items/{item_id}",
    response_model=MenuItemOut,
    summary="Get single menu item details (Public & Staff)",
    status_code=status.HTTP_200_OK,
)
async def get_menu_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve dish details for single item by UUID."""
    return await menu_service.get_menu_item_by_id(db, item_id)


@router.post(
    "/items",
    response_model=MenuItemOut,
    summary="Create a new menu item (Admin & Manager)",
    status_code=status.HTTP_201_CREATED,
)
async def create_menu_item(
    payload: MenuItemCreate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new menu item. Requires Admin or Manager role."""
    return await menu_service.create_menu_item(db, payload)


@router.put(
    "/items/{item_id}",
    response_model=MenuItemOut,
    summary="Edit menu item (Admin & Manager)",
    status_code=status.HTTP_200_OK,
)
async def update_menu_item(
    item_id: uuid.UUID,
    payload: MenuItemUpdate,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update menu item attributes. Requires Admin or Manager role."""
    return await menu_service.update_menu_item(db, item_id, payload)


@router.patch(
    "/items/{item_id}/availability",
    response_model=MenuItemOut,
    summary="Toggle menu item availability (Admin & Manager)",
    status_code=status.HTTP_200_OK,
)
async def toggle_availability(
    item_id: uuid.UUID,
    is_available: bool = Query(..., description="Target availability state"),
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Toggle menu item availability (Available/Unavailable). Requires Admin or Manager role."""
    return await menu_service.toggle_menu_item_availability(db, item_id, is_available)


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete menu item (Admin & Manager)",
)
async def delete_menu_item(
    item_id: uuid.UUID,
    _: User = Depends(require_role(["admin", "manager"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a menu item. Requires Admin or Manager role."""
    await menu_service.delete_menu_item(db, item_id)


@router.post(
    "/items/image",
    summary="Upload menu dish image to Cloudflare R2 (Admin & Manager)",
    status_code=status.HTTP_200_OK,
)
async def upload_menu_image(
    file: UploadFile = File(...),
    _: User = Depends(require_role(["admin", "manager"])),
) -> dict[str, str]:
    """Upload dish image to Cloudflare R2 object storage."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, WEBP, and AVIF image files are allowed.",
        )

    file_bytes = await file.read()
    image_url = await upload_file_to_r2(
        file_bytes=file_bytes,
        filename=file.filename or "dish.jpg",
        content_type=file.content_type,
        folder="menu-items",
    )
    return {"image_url": image_url}
