"""
Service layer for Recipe Management, Stock Verification, Automatic Inventory Deduction on Order Acceptance, and Automatic Menu Availability Synchronization.
"""

import logging
import uuid
from math import floor

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.settings import settings
from app.models.menu import MenuItem
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.recipe import Ingredient, Recipe, RecipeIngredient, StockHistory
from app.schemas.recipe import (
    RecipeCreatePayload,
    RecipeIngredientOut,
    RecipeOut,
)

logger = logging.getLogger("app.services.recipe")


def _build_recipe_out(recipe: Recipe, is_available: bool = True) -> RecipeOut:
    ing_outs = []
    portions_list = []

    for ri in recipe.recipe_ingredients:
        ing = ri.ingredient
        cur_stock = float(ing.current_stock) if ing else 0.0
        req_qty = float(ri.quantity)
        min_stock = float(ing.minimum_stock) if ing else 0.0
        unit_cost = float(ing.unit_cost) if ing else 0.0
        ing_name = ing.name if ing else "Unknown Ingredient"

        if req_qty > 0:
            portions_list.append(floor(cur_stock / req_qty))

        ing_outs.append(
            RecipeIngredientOut(
                id=ri.id,
                ingredient_id=ri.ingredient_id,
                ingredient_name=ing_name,
                quantity=req_qty,
                unit_of_measure=ri.unit_of_measure,
                current_stock=cur_stock,
                minimum_stock=min_stock,
                unit_cost=unit_cost,
            )
        )

    max_portions = min(portions_list) if portions_list else 0

    return RecipeOut(
        id=recipe.id,
        menu_item_id=recipe.menu_item_id,
        menu_item_name=recipe.menu_item.name if recipe.menu_item else None,
        name=recipe.name,
        instructions=recipe.instructions,
        yields=float(recipe.yields),
        ingredients=ing_outs,
        max_makeable_portions=max_portions,
        is_available=is_available,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


# --- AUTOMATIC MENU AVAILABILITY SYNC ---

async def check_and_update_menu_item_availability(
    db: AsyncSession, menu_item_id: uuid.UUID
) -> bool:
    """
    Check if all recipe ingredients for a menu item are in stock for at least 1 portion.
    If stock is insufficient, automatically mark menu item as unavailable (is_available = False).
    If stock is restored, automatically re-enable menu item (is_available = True).
    """
    res = await db.execute(
        select(MenuItem)
        .options(
            selectinload(MenuItem.recipes).selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient)
        )
        .where(MenuItem.id == menu_item_id, MenuItem.deleted_at.is_(None))
    )
    menu_item = res.scalar_one_or_none()
    if not menu_item or not menu_item.recipes:
        return True

    recipe = menu_item.recipes[0]
    is_makeable = True

    for ri in recipe.recipe_ingredients:
        ing = ri.ingredient
        if not ing or float(ing.current_stock) < float(ri.quantity):
            is_makeable = False
            break

    if menu_item.is_available != is_makeable:
        menu_item.is_available = is_makeable
        logger.info(
            "Auto-updated menu item '%s' availability to %s based on inventory stock.",
            menu_item.name,
            is_makeable,
        )

    return is_makeable


async def sync_menu_availability_for_ingredient(
    db: AsyncSession, ingredient_id: uuid.UUID
) -> None:
    """Synchronize menu availability for all menu items that depend on a specific ingredient."""
    res = await db.execute(
        select(RecipeIngredient.recipe_id).where(RecipeIngredient.ingredient_id == ingredient_id)
    )
    recipe_ids = res.scalars().all()
    if not recipe_ids:
        return

    rec_res = await db.execute(
        select(Recipe.menu_item_id).where(Recipe.id.in_(recipe_ids))
    )
    menu_item_ids = rec_res.scalars().all()

    for m_id in set(menu_item_ids):
        await check_and_update_menu_item_availability(db, m_id)


# --- RECIPE CRUD ---

async def get_all_recipes(db: AsyncSession) -> list[RecipeOut]:
    """List all recipes with ingredients and makeable portion calculations."""
    res = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.menu_item),
            selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient),
        )
        .order_by(Recipe.name.asc())
    )
    recipes = res.scalars().all()

    out_list = []
    for r in recipes:
        is_avail = r.menu_item.is_available if r.menu_item else True
        out_list.append(_build_recipe_out(r, is_available=is_avail))

    return out_list


async def get_recipe_by_menu_item_id(
    db: AsyncSession, menu_item_id: uuid.UUID
) -> RecipeOut | None:
    """Get recipe associated with a specific menu item."""
    res = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.menu_item),
            selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient),
        )
        .where(Recipe.menu_item_id == menu_item_id)
    )
    recipe = res.scalar_one_or_none()
    if not recipe:
        return None

    is_avail = recipe.menu_item.is_available if recipe.menu_item else True
    return _build_recipe_out(recipe, is_available=is_avail)


async def create_or_update_recipe(
    db: AsyncSession, payload: RecipeCreatePayload
) -> RecipeOut:
    """Create or update a menu item recipe with ingredient validation and auto availability sync."""
    # Verify menu item exists
    mi_res = await db.execute(select(MenuItem).where(MenuItem.id == payload.menu_item_id))
    menu_item = mi_res.scalar_one_or_none()
    if not menu_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    # Check for existing recipe
    rec_res = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.recipe_ingredients))
        .where(Recipe.menu_item_id == payload.menu_item_id)
    )
    recipe = rec_res.scalar_one_or_none()

    if recipe:
        recipe.name = payload.name.strip()
        recipe.instructions = payload.instructions
        recipe.yields = payload.yields
        # Clear old ingredients
        recipe.recipe_ingredients.clear()
    else:
        recipe = Recipe(
            menu_item_id=payload.menu_item_id,
            name=payload.name.strip(),
            instructions=payload.instructions,
            yields=payload.yields,
        )
        db.add(recipe)

    await db.flush()

    # Add ingredients
    for ing_input in payload.ingredients:
        # Verify ingredient exists
        ing_res = await db.execute(select(Ingredient).where(Ingredient.id == ing_input.ingredient_id))
        ing_obj = ing_res.scalar_one_or_none()
        if not ing_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ingredient ID {ing_input.ingredient_id} not found.",
            )

        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ing_input.ingredient_id,
                quantity=ing_input.quantity,
                unit_of_measure=ing_input.unit_of_measure,
            )
        )

    await db.commit()

    # Auto-sync menu availability
    await check_and_update_menu_item_availability(db, payload.menu_item_id)
    await db.commit()

    res_out = await get_recipe_by_menu_item_id(db, payload.menu_item_id)
    if not res_out:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve saved recipe.")
    return res_out


async def delete_recipe(db: AsyncSession, recipe_id: uuid.UUID) -> None:
    """Delete a recipe and restore default menu item availability."""
    res = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = res.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")

    menu_item_id = recipe.menu_item_id
    await db.delete(recipe)
    await db.commit()

    # Restore menu item availability if needed
    mi_res = await db.execute(select(MenuItem).where(MenuItem.id == menu_item_id))
    menu_item = mi_res.scalar_one_or_none()
    if menu_item:
        menu_item.is_available = True
        await db.commit()


# --- AUTOMATIC INVENTORY DEDUCTION & STOCK VERIFICATION ON ORDER ACCEPTANCE ---

async def deduct_inventory_for_order(
    db: AsyncSession, order: Order, user_id: uuid.UUID | None = None
) -> None:
    """
    Verify stock and deduct required ingredient quantities inside a single database transaction.
    If stock is insufficient, raises HTTP 400 with missing ingredients and rolls back transaction.
    """
    # 1. Aggregate total required quantities per ingredient across all order items
    required_ingredients: dict[uuid.UUID, float] = {}

    for item in order.items:
        # Load recipe for menu item
        rec_res = await db.execute(
            select(Recipe)
            .options(selectinload(Recipe.recipe_ingredients))
            .where(Recipe.menu_item_id == item.menu_item_id)
        )
        recipe = rec_res.scalar_one_or_none()

        if recipe:
            for ri in recipe.recipe_ingredients:
                needed = float(ri.quantity) * item.quantity
                required_ingredients[ri.ingredient_id] = (
                    required_ingredients.get(ri.ingredient_id, 0.0) + needed
                )

    if not required_ingredients:
        # No ingredients required for this order
        return

    # 2. Lock ingredient rows and check current stock sufficiency
    missing_details = []
    locked_ingredients: dict[uuid.UUID, Ingredient] = {}

    for ing_id, total_needed in required_ingredients.items():
        stmt = select(Ingredient).where(
            Ingredient.id == ing_id, Ingredient.deleted_at.is_(None)
        )
        if not settings.DATABASE_URL.startswith("sqlite"):
            stmt = stmt.with_for_update()
        ing_res = await db.execute(stmt)
        ing_obj = ing_res.scalar_one_or_none()

        if not ing_obj:
            missing_details.append(f"Unknown Ingredient ({ing_id})")
            continue

        locked_ingredients[ing_id] = ing_obj
        cur_stock = float(ing_obj.current_stock)

        if cur_stock < total_needed:
            missing_qty = round(total_needed - cur_stock, 3)
            missing_details.append(
                f"{ing_obj.name}: Required {total_needed} {ing_obj.unit_of_measure}, Available {cur_stock} {ing_obj.unit_of_measure} (Short by {missing_qty} {ing_obj.unit_of_measure})"
            )

    # 3. If stock is insufficient, reject acceptance and notify Kitchen Staff
    if missing_details:
        err_msg = f"Cannot accept Order {order.order_number} due to insufficient ingredient stock: {'; '.join(missing_details)}"
        logger.warning(err_msg)

        # Notify Kitchen Staff
        db.add(
            Notification(
                recipient_type="kitchen_staff",
                title=f"🚨 Stock Insufficient for Order {order.order_number}",
                message=err_msg,
                notification_type="system_alert",
                status="unread",
                payload_json={"link": "/inventory"},
            )
        )
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    # 4. Perform atomic stock deductions & record StockHistory
    for ing_id, total_needed in required_ingredients.items():
        ing = locked_ingredients[ing_id]
        prev_stock = float(ing.current_stock)
        new_stock = prev_stock - total_needed

        ing.current_stock = new_stock
        ing.version_id += 1

        db.add(
            StockHistory(
                ingredient_id=ing.id,
                previous_quantity=prev_stock,
                new_quantity=new_stock,
                change_amount=-total_needed,
                action_type="order_deduction",
                reason=f"Order {order.order_number}",
                invoice_number=order.order_number,
                notes=f"Automatic inventory deduction for Order {order.order_number}",
                recorded_by_user_id=user_id,
            )
        )

        # Sync menu availability if ingredient stock fell to 0 or below minimum
        await sync_menu_availability_for_ingredient(db, ing.id)
