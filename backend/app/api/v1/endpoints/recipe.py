"""
API Endpoints for Recipe Management and Menu Item Ingredient Composition.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.recipe import RecipeCreatePayload, RecipeOut
from app.services import recipe as recipe_service

router = APIRouter(tags=["Recipe Management"])


@router.get(
    "",
    response_model=list[RecipeOut],
    include_in_schema=False,
)
@router.get(
    "/",
    response_model=list[RecipeOut],
    summary="List all recipes with ingredient requirements",
    status_code=status.HTTP_200_OK,
)
async def get_all_recipes(
    _: User = Depends(require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve all menu item recipes, required ingredients, and portion availability."""
    return await recipe_service.get_all_recipes(db)


@router.get(
    "/menu-item/{menu_item_id}",
    response_model=RecipeOut | None,
    summary="Get recipe by menu item ID",
    status_code=status.HTTP_200_OK,
)
async def get_recipe_by_menu_item_id(
    menu_item_id: uuid.UUID,
    _: User = Depends(require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve recipe and ingredient breakdown for a specific menu item."""
    return await recipe_service.get_recipe_by_menu_item_id(db, menu_item_id)


@router.post(
    "",
    response_model=RecipeOut,
    include_in_schema=False,
)
@router.post(
    "/",
    response_model=RecipeOut,
    summary="Create or update menu item recipe (Manager/Admin)",
    status_code=status.HTTP_200_OK,
)
async def create_or_update_recipe(
    payload: RecipeCreatePayload,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create or update a menu item recipe with ingredient validation and automatic availability sync."""
    return await recipe_service.create_or_update_recipe(db, payload)


@router.delete(
    "/{recipe_id}",
    summary="Delete recipe (Manager/Admin)",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_recipe(
    recipe_id: uuid.UUID,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a recipe and restore default menu item availability."""
    await recipe_service.delete_recipe(db, recipe_id)
