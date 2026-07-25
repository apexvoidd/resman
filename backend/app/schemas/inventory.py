"""
Pydantic schemas for Ingredient Inventory Management, Restocking, Stock Adjustments, and Waste Recording.
"""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


# --- CATEGORY SCHEMAS ---

class IngredientCategoryCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str | None, Field(max_length=500)] = None


class IngredientCategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- INGREDIENT SCHEMAS ---

class IngredientCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    category_id: uuid.UUID | None = None
    unit_of_measure: Literal["kg", "g", "L", "ml", "pcs"] = Field(..., description="Unit of measurement")
    current_stock: float = Field(default=0.0, ge=0.0, description="Initial stock quantity")
    minimum_stock: float = Field(default=0.0, ge=0.0, description="Minimum stock threshold for low stock alert")
    reorder_level: float = Field(default=0.0, ge=0.0, description="Reorder level quantity")
    unit_cost: float = Field(default=0.0, ge=0.0, description="Cost per unit")
    supplier: Annotated[str | None, Field(max_length=255)] = None
    is_active: bool = True


class IngredientUpdate(BaseModel):
    name: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    category_id: uuid.UUID | None = None
    unit_of_measure: Literal["kg", "g", "L", "ml", "pcs"] | None = None
    minimum_stock: float | None = Field(default=None, ge=0.0)
    reorder_level: float | None = Field(default=None, ge=0.0)
    unit_cost: float | None = Field(default=None, ge=0.0)
    supplier: Annotated[str | None, Field(max_length=255)] = None
    is_active: bool | None = None


class IngredientOut(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    unit_of_measure: str
    current_stock: float
    minimum_stock: float
    reorder_level: float
    unit_cost: float
    supplier: str | None = None
    is_active: bool
    version_id: int
    stock_status: Literal["in_stock", "low_stock", "out_of_stock"]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- RESTOCK, ADJUSTMENT, WASTE SCHEMAS ---

class RestockInput(BaseModel):
    quantity: float = Field(..., gt=0.0, description="Restock quantity must be positive")
    purchase_price: float = Field(..., ge=0.0, description="Purchase cost per unit")
    supplier: Annotated[str | None, Field(max_length=255)] = None
    invoice_number: Annotated[str | None, Field(max_length=100)] = None
    notes: Annotated[str | None, Field(max_length=1000)] = None


class ManualAdjustmentInput(BaseModel):
    adjustment_type: Literal["increase", "decrease"]
    quantity: float = Field(..., gt=0.0, description="Adjustment quantity must be positive")
    reason: Literal[
        "Stock Count Correction",
        "Damage",
        "Expired",
        "Testing",
        "Other",
    ]
    notes: Annotated[str | None, Field(max_length=1000)] = None


class WasteRecordInput(BaseModel):
    quantity: float = Field(..., gt=0.0, description="Wasted quantity must be positive")
    reason: Annotated[str, Field(min_length=1, max_length=255)]
    notes: Annotated[str | None, Field(max_length=1000)] = None


# --- AUDIT LOG & DASHBOARD SCHEMAS ---

class StockHistoryOut(BaseModel):
    id: uuid.UUID
    ingredient_id: uuid.UUID
    ingredient_name: str | None = None
    previous_quantity: float
    new_quantity: float
    change_amount: float
    action_type: str
    reason: str | None = None
    invoice_number: str | None = None
    supplier: str | None = None
    notes: str | None = None
    recorded_by_user_id: uuid.UUID | None = None
    recorded_by_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WasteRecordOut(BaseModel):
    id: uuid.UUID
    ingredient_id: uuid.UUID | None = None
    ingredient_name: str | None = None
    quantity: float
    reason: str
    cost_impact: float
    notes: str | None = None
    recorded_by_user_id: uuid.UUID | None = None
    recorded_by_name: str | None = None
    waste_date: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryDashboardOut(BaseModel):
    total_ingredients: int
    low_stock_count: int
    out_of_stock_count: int
    in_stock_count: int
    total_inventory_value: float
