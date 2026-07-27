"""Pydantic schemas for Manager endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class TopSellingItem(BaseModel):
    name: str
    quantity_sold: int
    total_sales: float


class ManagerOverviewResponse(BaseModel):
    today_revenue: float
    paid_bills_count: int
    total_orders_today: int
    active_orders_count: int
    total_tables: int
    occupied_tables: int
    occupancy_rate: float
    low_stock_count: int
    today_waste_cost: float
    avg_csat: float
    top_selling_items: list[TopSellingItem]


class RecipeProfitabilityItem(BaseModel):
    recipe_id: str
    menu_item_id: str
    menu_item_name: str
    selling_price: float
    recipe_cost: float
    gross_profit: float
    margin_percent: float
    max_makeable_portions: int
    suggested_price_for_70pct_margin: float
    ingredient_breakdown: list[dict[str, Any]]
    is_available: bool


class BroadcastRequestPayload(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    message: str = Field(..., min_length=2, max_length=500)
    priority: str = "urgent"
