"""
Service layer for Ingredient Inventory Management, Stock Restocking, Manual Adjustments, Waste Logging, and Audit History.
"""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification import Notification
from app.models.recipe import (
    Ingredient,
    IngredientCategory,
    PurchaseHistory,
    StockHistory,
    WasteRecord,
)
from app.models.staff import User
from app.schemas.inventory import (
    IngredientCategoryCreate,
    IngredientCategoryOut,
    IngredientCreate,
    IngredientOut,
    IngredientUpdate,
    InventoryDashboardOut,
    ManualAdjustmentInput,
    RestockInput,
    StockHistoryOut,
    WasteRecordInput,
    WasteRecordOut,
)

logger = logging.getLogger("app.services.inventory")

DEFAULT_CATEGORIES = [
    "Vegetables",
    "Dairy",
    "Meat",
    "Seafood",
    "Beverages",
    "Spices",
    "Bakery",
    "Frozen",
    "Others",
]


def _determine_stock_status(current_stock: float, minimum_stock: float) -> str:
    if current_stock <= 0:
        return "out_of_stock"
    elif current_stock <= minimum_stock:
        return "low_stock"
    return "in_stock"


def _build_ingredient_out(ingredient: Ingredient) -> IngredientOut:
    cat_name = ingredient.category.name if ingredient.category else None
    stock_status = _determine_stock_status(
        float(ingredient.current_stock), float(ingredient.minimum_stock)
    )

    return IngredientOut(
        id=ingredient.id,
        name=ingredient.name,
        category_id=ingredient.category_id,
        category_name=cat_name,
        unit_of_measure=ingredient.unit_of_measure,
        current_stock=float(ingredient.current_stock),
        minimum_stock=float(ingredient.minimum_stock),
        reorder_level=float(ingredient.reorder_level),
        unit_cost=float(ingredient.unit_cost),
        supplier=ingredient.supplier,
        is_active=ingredient.is_active,
        version_id=ingredient.version_id,
        stock_status=stock_status,
        created_at=ingredient.created_at,
        updated_at=ingredient.updated_at,
    )


# --- CATEGORIES ---


async def seed_default_categories(db: AsyncSession) -> None:
    """Pre-populate standard ingredient categories if table is empty."""
    res = await db.execute(select(func.count(IngredientCategory.id)))
    count = res.scalar() or 0
    if count == 0:
        for cat_name in DEFAULT_CATEGORIES:
            db.add(IngredientCategory(name=cat_name))
        await db.commit()


async def get_categories(db: AsyncSession) -> list[IngredientCategoryOut]:
    await seed_default_categories(db)
    result = await db.execute(
        select(IngredientCategory).order_by(IngredientCategory.name.asc())
    )
    categories = result.scalars().all()
    return [IngredientCategoryOut.model_validate(c) for c in categories]


async def create_category(
    db: AsyncSession, payload: IngredientCategoryCreate
) -> IngredientCategoryOut:
    existing = await db.execute(
        select(IngredientCategory).where(
            func.lower(IngredientCategory.name) == payload.name.strip().lower()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{payload.name}' already exists.",
        )

    cat = IngredientCategory(name=payload.name.strip(), description=payload.description)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return IngredientCategoryOut.model_validate(cat)


# --- DASHBOARD & INGREDIENT LIST ---


async def get_inventory_dashboard(db: AsyncSession) -> InventoryDashboardOut:
    """Compute aggregate counts for dashboard: total, low stock, out of stock, in stock, total value."""
    result = await db.execute(select(Ingredient).where(Ingredient.deleted_at.is_(None)))
    ingredients = result.scalars().all()

    total_cnt = len(ingredients)
    low_cnt = 0
    out_cnt = 0
    in_cnt = 0
    total_val = 0.0

    for ing in ingredients:
        curr = float(ing.current_stock)
        min_st = float(ing.minimum_stock)
        cost = float(ing.unit_cost)

        total_val += curr * cost

        if curr <= 0:
            out_cnt += 1
        elif curr <= min_st:
            low_cnt += 1
        else:
            in_cnt += 1

    return InventoryDashboardOut(
        total_ingredients=total_cnt,
        low_stock_count=low_cnt,
        out_of_stock_count=out_cnt,
        in_stock_count=in_cnt,
        total_inventory_value=round(total_val, 2),
    )


async def get_ingredients(
    db: AsyncSession,
    *,
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    stock_status: str | None = None,  # all, in_stock, low_stock, out_of_stock
    is_active: bool | None = None,
    sort_by: str | None = "name",  # name, stock_asc, stock_desc, cost
) -> list[IngredientOut]:
    """Retrieve filtered and sorted list of raw ingredients."""
    query = (
        select(Ingredient)
        .options(selectinload(Ingredient.category))
        .where(Ingredient.deleted_at.is_(None))
    )

    if is_active is not None:
        query = query.where(Ingredient.is_active.is_(is_active))

    if category_id:
        query = query.where(Ingredient.category_id == category_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(Ingredient.name.ilike(term))

    if sort_by == "stock_asc":
        query = query.order_by(Ingredient.current_stock.asc())
    elif sort_by == "stock_desc":
        query = query.order_by(Ingredient.current_stock.desc())
    elif sort_by == "cost":
        query = query.order_by(Ingredient.unit_cost.desc())
    else:  # name
        query = query.order_by(Ingredient.name.asc())

    result = await db.execute(query)
    ingredients = result.scalars().all()

    # Filter stock status in Python for accuracy across dynamic minimum thresholds
    out_list = [_build_ingredient_out(i) for i in ingredients]
    if stock_status and stock_status != "all":
        out_list = [i for i in out_list if i.stock_status == stock_status]

    return out_list


async def get_ingredient_by_id(
    db: AsyncSession, ingredient_id: uuid.UUID
) -> IngredientOut:
    result = await db.execute(
        select(Ingredient)
        .options(selectinload(Ingredient.category))
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )
    return _build_ingredient_out(ing)


# --- CRUD OPERATIONS ---


async def create_ingredient(
    db: AsyncSession, payload: IngredientCreate, user_id: uuid.UUID | None = None
) -> IngredientOut:
    """Create a new ingredient with duplicate check and initial stock audit log."""
    name_clean = payload.name.strip()
    existing = await db.execute(
        select(Ingredient).where(
            func.lower(Ingredient.name) == name_clean.lower(),
            Ingredient.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An ingredient named '{name_clean}' already exists.",
        )

    ing = Ingredient(
        name=name_clean,
        category_id=payload.category_id,
        unit_of_measure=payload.unit_of_measure,
        current_stock=payload.current_stock,
        minimum_stock=payload.minimum_stock,
        reorder_level=payload.reorder_level,
        unit_cost=payload.unit_cost,
        supplier=payload.supplier,
        is_active=payload.is_active,
        version_id=1,
    )
    db.add(ing)
    await db.flush()

    # Create initial stock log entry
    if payload.current_stock > 0:
        db.add(
            StockHistory(
                ingredient_id=ing.id,
                previous_quantity=0.0,
                new_quantity=payload.current_stock,
                change_amount=payload.current_stock,
                action_type="create",
                reason="Initial Stock Setup",
                notes="Ingredient created with initial stock.",
                recorded_by_user_id=user_id,
            )
        )

    await db.commit()

    # Re-query with category
    return await get_ingredient_by_id(db, ing.id)


async def update_ingredient(
    db: AsyncSession,
    ingredient_id: uuid.UUID,
    payload: IngredientUpdate,
    user_id: uuid.UUID | None = None,
) -> IngredientOut:
    """Update ingredient details with locking and audit logging."""
    result = await db.execute(
        select(Ingredient)
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
        .with_for_update()
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )

    if payload.name and payload.name.strip().lower() != ing.name.lower():
        name_clean = payload.name.strip()
        existing = await db.execute(
            select(Ingredient).where(
                func.lower(Ingredient.name) == name_clean.lower(),
                Ingredient.id != ing.id,
                Ingredient.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An ingredient named '{name_clean}' already exists.",
            )
        ing.name = name_clean

    if payload.category_id is not None:
        ing.category_id = payload.category_id
    if payload.unit_of_measure is not None:
        ing.unit_of_measure = payload.unit_of_measure
    if payload.minimum_stock is not None:
        ing.minimum_stock = payload.minimum_stock
    if payload.reorder_level is not None:
        ing.reorder_level = payload.reorder_level
    if payload.unit_cost is not None:
        ing.unit_cost = payload.unit_cost
    if payload.supplier is not None:
        ing.supplier = payload.supplier
    if payload.is_active is not None:
        ing.is_active = payload.is_active

    ing.version_id += 1

    db.add(
        StockHistory(
            ingredient_id=ing.id,
            previous_quantity=float(ing.current_stock),
            new_quantity=float(ing.current_stock),
            change_amount=0.0,
            action_type="edit",
            reason="Ingredient Configuration Updated",
            notes="Updated ingredient details.",
            recorded_by_user_id=user_id,
        )
    )

    from app.services.recipe import sync_menu_availability_for_ingredient

    await sync_menu_availability_for_ingredient(db, ing.id)

    await db.commit()
    return await get_ingredient_by_id(db, ing.id)


async def toggle_ingredient_status(
    db: AsyncSession,
    ingredient_id: uuid.UUID,
    is_active: bool,
    user_id: uuid.UUID | None = None,
) -> IngredientOut:
    """Disable or enable ingredient."""
    result = await db.execute(
        select(Ingredient)
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
        .with_for_update()
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )

    ing.is_active = is_active
    ing.version_id += 1

    action_text = "Enabled" if is_active else "Disabled"
    db.add(
        StockHistory(
            ingredient_id=ing.id,
            previous_quantity=float(ing.current_stock),
            new_quantity=float(ing.current_stock),
            change_amount=0.0,
            action_type="edit",
            reason=f"Ingredient {action_text}",
            notes=f"Ingredient marked as {'active' if is_active else 'inactive'}.",
            recorded_by_user_id=user_id,
        )
    )

    await db.commit()
    return await get_ingredient_by_id(db, ing.id)


# --- RESTOCKING, ADJUSTMENT & WASTE ---


async def restock_ingredient(
    db: AsyncSession,
    ingredient_id: uuid.UUID,
    payload: RestockInput,
    user_id: uuid.UUID | None = None,
) -> IngredientOut:
    """
    Add stock to ingredient with optimistic/pessimistic locking and audit logging.
    """
    result = await db.execute(
        select(Ingredient)
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
        .with_for_update()
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )

    prev_qty = float(ing.current_stock)
    new_qty = prev_qty + payload.quantity

    ing.current_stock = new_qty
    ing.unit_cost = payload.purchase_price
    if payload.supplier:
        ing.supplier = payload.supplier
    ing.version_id += 1

    # Log PurchaseHistory
    total_cost = payload.quantity * payload.purchase_price
    supplier_str = payload.supplier or ing.supplier or "Unknown Supplier"
    db.add(
        PurchaseHistory(
            ingredient_id=ing.id,
            supplier_name=supplier_str,
            quantity=payload.quantity,
            unit_cost=payload.purchase_price,
            total_cost=total_cost,
            invoice_number=payload.invoice_number,
            notes=payload.notes,
            recorded_by_user_id=user_id,
        )
    )

    # Log StockHistory
    db.add(
        StockHistory(
            ingredient_id=ing.id,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            change_amount=payload.quantity,
            action_type="restock",
            reason="Restock Shipment Received",
            invoice_number=payload.invoice_number,
            supplier=supplier_str,
            notes=payload.notes,
            recorded_by_user_id=user_id,
        )
    )

    from app.services.recipe import sync_menu_availability_for_ingredient

    await sync_menu_availability_for_ingredient(db, ing.id)

    await db.commit()
    return await get_ingredient_by_id(db, ing.id)


async def adjust_stock(
    db: AsyncSession,
    ingredient_id: uuid.UUID,
    payload: ManualAdjustmentInput,
    user_id: uuid.UUID | None = None,
) -> IngredientOut:
    """
    Manual stock adjustment (Increase / Decrease) with required reason and conflict protection.
    """
    result = await db.execute(
        select(Ingredient)
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
        .with_for_update()
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )

    prev_qty = float(ing.current_stock)

    if payload.adjustment_type == "decrease":
        if prev_qty < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot decrease stock by {payload.quantity} {ing.unit_of_measure}. Current stock is only {prev_qty} {ing.unit_of_measure}.",
            )
        new_qty = prev_qty - payload.quantity
        change_amt = -payload.quantity
        action_st = "adjustment_decrease"
    else:
        new_qty = prev_qty + payload.quantity
        change_amt = payload.quantity
        action_st = "adjustment_increase"

    ing.current_stock = new_qty
    ing.version_id += 1

    db.add(
        StockHistory(
            ingredient_id=ing.id,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            change_amount=change_amt,
            action_type=action_st,
            reason=payload.reason,
            notes=payload.notes,
            recorded_by_user_id=user_id,
        )
    )

    # Low Stock Alert Notification if stock dropped to or below minimum
    if new_qty <= float(ing.minimum_stock):
        status_lbl = "Out of Stock" if new_qty == 0 else "Low Stock"
        db.add(
            Notification(
                recipient_type="kitchen_staff",
                title=f"⚠️ {status_lbl}: {ing.name}",
                message=f"Stock level for '{ing.name}' is now {new_qty} {ing.unit_of_measure} (Min threshold: {ing.minimum_stock}).",
                notification_type="system_alert",
                status="unread",
                payload_json={"link": "/inventory"},
            )
        )

    from app.services.recipe import sync_menu_availability_for_ingredient

    await sync_menu_availability_for_ingredient(db, ing.id)

    await db.commit()
    return await get_ingredient_by_id(db, ing.id)


async def record_waste(
    db: AsyncSession,
    ingredient_id: uuid.UUID,
    payload: WasteRecordInput,
    user_id: uuid.UUID | None = None,
) -> WasteRecordOut:
    """Record ingredient waste, decrease stock, and log audit trail."""
    result = await db.execute(
        select(Ingredient)
        .where(Ingredient.id == ingredient_id, Ingredient.deleted_at.is_(None))
        .with_for_update()
    )
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found."
        )

    prev_qty = float(ing.current_stock)
    if prev_qty < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record waste of {payload.quantity} {ing.unit_of_measure}. Current stock is only {prev_qty} {ing.unit_of_measure}.",
        )

    new_qty = prev_qty - payload.quantity
    ing.current_stock = new_qty
    ing.version_id += 1

    cost_impact = payload.quantity * float(ing.unit_cost)

    waste_rec = WasteRecord(
        ingredient_id=ing.id,
        quantity=payload.quantity,
        reason=payload.reason,
        cost_impact=cost_impact,
        notes=payload.notes,
        recorded_by_user_id=user_id,
    )
    db.add(waste_rec)

    db.add(
        StockHistory(
            ingredient_id=ing.id,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            change_amount=-payload.quantity,
            action_type="waste",
            reason=f"Waste: {payload.reason}",
            notes=payload.notes,
            recorded_by_user_id=user_id,
        )
    )

    from app.services.recipe import sync_menu_availability_for_ingredient

    await sync_menu_availability_for_ingredient(db, ing.id)

    await db.commit()
    await db.refresh(waste_rec)

    user_name = None
    if user_id:
        u_res = await db.execute(select(User).where(User.id == user_id))
        user_obj = u_res.scalar_one_or_none()
        if user_obj:
            user_name = user_obj.full_name

    return WasteRecordOut(
        id=waste_rec.id,
        ingredient_id=ing.id,
        ingredient_name=ing.name,
        quantity=float(waste_rec.quantity),
        reason=waste_rec.reason,
        cost_impact=float(waste_rec.cost_impact),
        notes=waste_rec.notes,
        recorded_by_user_id=user_id,
        recorded_by_name=user_name,
        waste_date=waste_rec.waste_date,
    )


# --- STOCK HISTORY & AUDIT LOGS ---


async def get_stock_history(
    db: AsyncSession, ingredient_id: uuid.UUID | None = None, limit: int = 100
) -> list[StockHistoryOut]:
    """Retrieve chronological inventory stock change audit history."""
    query = (
        select(StockHistory)
        .options(
            selectinload(StockHistory.ingredient),
            selectinload(StockHistory.recorded_by),
        )
        .order_by(StockHistory.created_at.desc())
        .limit(limit)
    )

    if ingredient_id:
        query = query.where(StockHistory.ingredient_id == ingredient_id)

    result = await db.execute(query)
    histories = result.scalars().all()

    out_list = []
    for h in histories:
        ing_name = h.ingredient.name if h.ingredient else None
        rec_name = (
            h.recorded_by.name or h.recorded_by.email if h.recorded_by else "System"
        )

        out_list.append(
            StockHistoryOut(
                id=h.id,
                ingredient_id=h.ingredient_id,
                ingredient_name=ing_name,
                previous_quantity=float(h.previous_quantity),
                new_quantity=float(h.new_quantity),
                change_amount=float(h.change_amount),
                action_type=h.action_type,
                reason=h.reason,
                invoice_number=h.invoice_number,
                supplier=h.supplier,
                notes=h.notes,
                recorded_by_user_id=h.recorded_by_user_id,
                recorded_by_name=rec_name,
                created_at=h.created_at,
            )
        )

    return out_list
