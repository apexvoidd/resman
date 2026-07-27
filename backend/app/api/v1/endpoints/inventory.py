"""
API Endpoints for Ingredient Inventory Management, Restocking, Stock Adjustments, Waste Recording, and Audit History.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
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
from app.services import inventory as inventory_service

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])


@router.get(
    "/dashboard",
    response_model=InventoryDashboardOut,
    summary="Get inventory dashboard metrics",
    status_code=status.HTTP_200_OK,
)
async def get_inventory_dashboard(
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve total ingredients count, low stock count, out of stock count, and total valuation."""
    return await inventory_service.get_inventory_dashboard(db)


@router.get(
    "/categories",
    response_model=list[IngredientCategoryOut],
    summary="List ingredient categories",
    status_code=status.HTTP_200_OK,
)
async def get_categories(
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve list of all ingredient categories."""
    return await inventory_service.get_categories(db)


@router.post(
    "/categories",
    response_model=IngredientCategoryOut,
    summary="Create ingredient category",
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: IngredientCategoryCreate,
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new ingredient category."""
    return await inventory_service.create_category(db, payload)


@router.get(
    "/ingredients",
    response_model=list[IngredientOut],
    summary="List ingredients with search, filter, and sorting",
    status_code=status.HTTP_200_OK,
)
async def get_ingredients(
    search: str | None = Query(None, description="Search ingredient name"),
    category_id: uuid.UUID | None = Query(None, description="Filter by category ID"),
    stock_status: str | None = Query(
        None,
        description="Filter by stock status: all, in_stock, low_stock, out_of_stock",
    ),
    is_active: bool | None = Query(None, description="Filter by active status"),
    sort_by: str | None = Query(
        "name", description="Sort by: name, stock_asc, stock_desc, cost"
    ),
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """List ingredients with search, category filtering, stock alert filter, and sorting."""
    return await inventory_service.get_ingredients(
        db,
        search=search,
        category_id=category_id,
        stock_status=stock_status,
        is_active=is_active,
        sort_by=sort_by,
    )


@router.post(
    "/ingredients",
    response_model=IngredientOut,
    summary="Add new ingredient",
    status_code=status.HTTP_201_CREATED,
)
async def create_ingredient(
    payload: IngredientCreate,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new ingredient with non-duplicate name check and initial stock audit logging."""
    return await inventory_service.create_ingredient(db, payload, current_user.id)


@router.get(
    "/ingredients/{ingredient_id}",
    response_model=IngredientOut,
    summary="Get single ingredient details",
    status_code=status.HTTP_200_OK,
)
async def get_ingredient_by_id(
    ingredient_id: uuid.UUID,
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get single ingredient details by ID."""
    return await inventory_service.get_ingredient_by_id(db, ingredient_id)


@router.put(
    "/ingredients/{ingredient_id}",
    response_model=IngredientOut,
    summary="Edit ingredient",
    status_code=status.HTTP_200_OK,
)
async def update_ingredient(
    ingredient_id: uuid.UUID,
    payload: IngredientUpdate,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Edit ingredient configuration details."""
    return await inventory_service.update_ingredient(
        db, ingredient_id, payload, current_user.id
    )


@router.patch(
    "/ingredients/{ingredient_id}/status",
    response_model=IngredientOut,
    summary="Enable or disable ingredient",
    status_code=status.HTTP_200_OK,
)
async def toggle_ingredient_status(
    ingredient_id: uuid.UUID,
    is_active: bool = Query(..., description="Set active status"),
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Enable or disable an ingredient."""
    return await inventory_service.toggle_ingredient_status(
        db, ingredient_id, is_active, current_user.id
    )


@router.post(
    "/ingredients/{ingredient_id}/restock",
    response_model=IngredientOut,
    summary="Restock ingredient",
    status_code=status.HTTP_200_OK,
)
async def restock_ingredient(
    ingredient_id: uuid.UUID,
    payload: RestockInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Restock ingredient stock with purchase tracking and locking conflict protection."""
    return await inventory_service.restock_ingredient(
        db, ingredient_id, payload, current_user.id
    )


@router.post(
    "/ingredients/{ingredient_id}/adjust",
    response_model=IngredientOut,
    summary="Manual stock adjustment",
    status_code=status.HTTP_200_OK,
)
async def adjust_stock(
    ingredient_id: uuid.UUID,
    payload: ManualAdjustmentInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Manual stock adjustment (Increase or Decrease) with required reason."""
    return await inventory_service.adjust_stock(
        db, ingredient_id, payload, current_user.id
    )


@router.post(
    "/ingredients/{ingredient_id}/waste",
    response_model=WasteRecordOut,
    summary="Record ingredient wastage",
    status_code=status.HTTP_200_OK,
)
async def record_waste(
    ingredient_id: uuid.UUID,
    payload: WasteRecordInput,
    current_user: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Record ingredient waste, decrease stock, and log cost impact."""
    return await inventory_service.record_waste(
        db, ingredient_id, payload, current_user.id
    )


@router.get(
    "/history",
    response_model=list[StockHistoryOut],
    summary="Get stock change audit history",
    status_code=status.HTTP_200_OK,
)
async def get_stock_history(
    ingredient_id: uuid.UUID | None = Query(
        None, description="Optional filter by ingredient ID"
    ),
    limit: int = Query(100, ge=1, le=500, description="Limit history records"),
    _: User = Depends(
        require_role(["kitchen", "kitchen_staff", "chef", "manager", "admin"])
    ),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve chronological audit history of all inventory stock changes."""
    return await inventory_service.get_stock_history(
        db, ingredient_id=ingredient_id, limit=limit
    )
