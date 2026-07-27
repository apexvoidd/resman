"""
Manager Service for Executive Dashboard, Recipe Profitability, and Emergency Overrides.
"""

from datetime import UTC, datetime, time
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import Bill
from app.models.menu import MenuItem
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.recipe import Ingredient, Recipe, RecipeIngredient, WasteRecord
from app.models.review import Review
from app.models.table import DiningTable


async def get_manager_overview(db: AsyncSession) -> dict[str, Any]:
    """Real-time operational and financial metrics."""
    now = datetime.now(UTC)
    today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)

    rev_res = await db.execute(
        select(func.coalesce(func.sum(Bill.total_amount), 0.0)).where(
            Bill.status == "paid",
            Bill.created_at >= today_start,
        )
    )
    today_revenue = float(rev_res.scalar() or 0.0)

    bills_res = await db.execute(
        select(func.count(Bill.id)).where(
            Bill.status == "paid",
            Bill.created_at >= today_start,
        )
    )
    paid_bills_count = int(bills_res.scalar() or 0)

    total_orders_res = await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= today_start)
    )
    total_orders_today = int(total_orders_res.scalar() or 0)

    active_orders_res = await db.execute(
        select(func.count(Order.id)).where(
            Order.status.in_(["pending", "accepted", "preparing", "ready", "paused"])
        )
    )
    active_orders_count = int(active_orders_res.scalar() or 0)

    total_tables_res = await db.execute(
        select(func.count(DiningTable.id)).where(
            DiningTable.is_active.is_(True),
            DiningTable.deleted_at.is_(None),
        )
    )
    total_tables = int(total_tables_res.scalar() or 0)

    occupied_res = await db.execute(
        select(func.count(DiningTable.id)).where(
            DiningTable.is_active.is_(True),
            DiningTable.status == "occupied",
            DiningTable.deleted_at.is_(None),
        )
    )
    occupied_tables = int(occupied_res.scalar() or 0)
    occupancy_rate = (
        round((occupied_tables / total_tables * 100), 1) if total_tables > 0 else 0.0
    )

    low_stock_res = await db.execute(
        select(func.count(Ingredient.id)).where(
            Ingredient.is_active.is_(True),
            Ingredient.current_stock <= Ingredient.minimum_stock,
            Ingredient.deleted_at.is_(None),
        )
    )
    low_stock_count = int(low_stock_res.scalar() or 0)

    waste_res = await db.execute(
        select(func.coalesce(func.sum(WasteRecord.cost_impact), 0.0)).where(
            WasteRecord.created_at >= today_start
        )
    )
    today_waste_cost = float(waste_res.scalar() or 0.0)

    csat_res = await db.execute(
        select(func.coalesce(func.avg(Review.rating), 0.0)).where(
            Review.is_hidden.is_(False),
            Review.deleted_at.is_(None),
        )
    )
    avg_csat = round(float(csat_res.scalar() or 0.0), 1)

    top_items_res = await db.execute(
        select(
            MenuItem.name.label("item_name"),
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.total_price).label("total_sales"),
        )
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.created_at >= today_start)
        .group_by(MenuItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    )
    top_selling_items = [
        {
            "name": row.item_name,
            "quantity_sold": int(row.total_qty or 0),
            "total_sales": float(row.total_sales or 0.0),
        }
        for row in top_items_res.all()
    ]

    return {
        "today_revenue": today_revenue,
        "paid_bills_count": paid_bills_count,
        "total_orders_today": total_orders_today,
        "active_orders_count": active_orders_count,
        "total_tables": total_tables,
        "occupied_tables": occupied_tables,
        "occupancy_rate": occupancy_rate,
        "low_stock_count": low_stock_count,
        "today_waste_cost": today_waste_cost,
        "avg_csat": avg_csat,
        "top_selling_items": top_selling_items,
    }


async def get_recipe_profitability_analysis(db: AsyncSession) -> list[dict[str, Any]]:
    """Analyze recipe food costs and profit margins."""
    res = await db.execute(
        select(Recipe).options(
            selectinload(Recipe.menu_item),
            selectinload(Recipe.recipe_ingredients).selectinload(
                RecipeIngredient.ingredient
            ),
        )
    )
    recipes = res.scalars().all()

    analysis = []
    for r in recipes:
        menu_item = r.menu_item
        selling_price = (
            float(menu_item.price) if menu_item and menu_item.price is not None else 0.0
        )

        total_recipe_cost = 0.0
        ingredient_breakdown = []
        portion_limits = []

        for ri in r.recipe_ingredients:
            ing = ri.ingredient
            if ing:
                unit_cost = float(ing.unit_cost or 0.0)
                qty = float(ri.quantity or 0.0)
                cost = qty * unit_cost
                total_recipe_cost += cost

                current_stock_val = float(ing.current_stock or 0.0)
                if qty > 0:
                    portion_limits.append(int(current_stock_val // qty))

                ingredient_breakdown.append(
                    {
                        "ingredient_name": ing.name,
                        "quantity": qty,
                        "unit": ri.unit_of_measure or ing.unit_of_measure or "",
                        "unit_cost": unit_cost,
                        "total_cost": round(cost, 2),
                        "current_stock": current_stock_val,
                    }
                )

        gross_profit = selling_price - total_recipe_cost
        margin_percent = (
            (gross_profit / selling_price * 100) if selling_price > 0 else 0.0
        )
        max_makeable = min(portion_limits) if portion_limits else 0
        suggested_price = (
            round(total_recipe_cost / 0.30, 2)
            if total_recipe_cost > 0
            else selling_price
        )

        analysis.append(
            {
                "recipe_id": str(r.id),
                "menu_item_id": str(r.menu_item_id) if r.menu_item_id else "",
                "menu_item_name": menu_item.name if menu_item else r.name,
                "selling_price": selling_price,
                "recipe_cost": round(total_recipe_cost, 2),
                "gross_profit": round(gross_profit, 2),
                "margin_percent": round(margin_percent, 1),
                "max_makeable_portions": max_makeable,
                "suggested_price_for_70pct_margin": suggested_price,
                "ingredient_breakdown": ingredient_breakdown,
                "is_available": menu_item.is_available if menu_item else True,
            }
        )

    return sorted(analysis, key=lambda x: x["margin_percent"])


async def bulk_reset_tables(db: AsyncSession) -> int:
    """Reset all cleaning/out_of_service tables back to available."""
    res = await db.execute(
        update(DiningTable)
        .where(
            DiningTable.status.in_(["cleaning", "out_of_service"]),
            DiningTable.deleted_at.is_(None),
        )
        .values(status="available")
    )
    await db.commit()
    return res.rowcount


async def broadcast_manager_announcement(
    db: AsyncSession, title: str, message: str, priority: str = "urgent"
) -> int:
    """Broadcast an announcement to all staff roles."""
    staff_roles = ["waiter", "kitchen_staff", "cleaning_staff", "cashier"]
    for role in staff_roles:
        db.add(
            Notification(
                recipient_type=role,
                title=f"📢 {title}",
                message=message,
                notification_type="manager_announcement",
                status="unread",
                payload_json={"priority": priority},
            )
        )
    await db.commit()
    return len(staff_roles)
