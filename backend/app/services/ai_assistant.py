"""
AI Manager Assistant Service for ResMan OS.

Handles intent classification, live restaurant context gathering,
NVIDIA NIM API integration, domain guardrails, and intelligent query synthesis.
"""

import logging
import os
import uuid
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Bill
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem
from app.models.recipe import Ingredient, WasteRecord
from app.models.review import Review
from app.models.staff import User
from app.models.table import DiningTable
from app.schemas.ai import AIChatMessage, AIChatResponse
from app.services.manager import get_manager_overview, get_recipe_profitability_analysis

logger = logging.getLogger("app.services.ai_assistant")

NVIDIA_NIM_BASE_URL = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_MODEL = os.getenv("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct")

RESTAURANT_KEYWORDS = {
    "order", "orders", "revenue", "sale", "sales", "bill", "billing", "payment",
    "table", "tables", "occupancy", "seat", "seated", "kitchen", "kds", "prep",
    "preparation", "cook", "chef", "food", "menu", "dish", "dishes", "item", "items",
    "inventory", "stock", "ingredient", "ingredients", "waste", "wastage",
    "recipe", "recipes", "profit", "margin", "cost", "price", "pricing",
    "staff", "waiter", "cashier", "cleaner", "employee", "review", "csat",
    "rating", "customer", "customers", "overview", "summary", "kpi", "performance",
    "restaurant", "resman", "today", "operating", "hours", "shift"
}


def is_restaurant_query(message: str) -> bool:
    """Classify whether the message is related to restaurant operations."""
    text = message.lower()
    # Direct match check
    for word in RESTAURANT_KEYWORDS:
        if word in text:
            return True
    
    # Common conversational greetings or status inquiries
    general_greetings = ["hi", "hello", "hey", "help", "what can you do", "status", "report", "how are we doing", "metrics"]
    if any(g in text for g in general_greetings):
        return True
        
    return False


async def build_restaurant_live_context(db: AsyncSession) -> dict[str, Any]:
    """Fetch live data across all ResMan OS operational modules."""
    # 1. Manager overview metrics
    overview = await get_manager_overview(db)

    # 2. Low stock ingredients breakdown
    low_stock_res = await db.execute(
        select(Ingredient).where(
            Ingredient.is_active.is_(True),
            Ingredient.current_stock <= Ingredient.minimum_stock,
            Ingredient.deleted_at.is_(None),
        ).limit(10)
    )
    low_stock_items = [
        {
            "name": ing.name,
            "current_stock": float(ing.current_stock or 0),
            "minimum_stock": float(ing.minimum_stock or 0),
            "unit": ing.unit_of_measure or "",
            "unit_cost": float(ing.unit_cost or 0),
        }
        for ing in low_stock_res.scalars().all()
    ]

    # 3. Active kitchen queue details
    active_orders_res = await db.execute(
        select(Order).where(
            Order.status.in_(["pending", "accepted", "preparing", "ready", "paused"]),
            Order.deleted_at.is_(None),
        ).order_by(Order.created_at.asc()).limit(10)
    )
    active_orders = [
        {
            "order_number": ord.order_number,
            "status": ord.status,
            "priority": ord.priority,
            "created_at": ord.created_at.strftime("%H:%M:%S") if ord.created_at else "",
            "total_amount": float(ord.total_amount or 0.0),
        }
        for ord in active_orders_res.scalars().all()
    ]

    # 4. Tables overview
    tables_res = await db.execute(
        select(DiningTable).where(
            DiningTable.is_active.is_(True),
            DiningTable.deleted_at.is_(None),
        )
    )
    tables = tables_res.scalars().all()
    tables_by_status = {}
    for t in tables:
        tables_by_status[t.status] = tables_by_status.get(t.status, 0) + 1

    # 5. Recipe Profitability highlights
    recipes_analysis = await get_recipe_profitability_analysis(db)
    low_margin_recipes = [
        {
            "menu_item": r["menu_item_name"],
            "selling_price": r["selling_price"],
            "cost": r["recipe_cost"],
            "margin_pct": r["margin_percent"],
            "suggested_price": r["suggested_price_for_70pct_margin"],
            "max_makeable": r["max_makeable_portions"],
        }
        for r in recipes_analysis[:5]
    ]

    # 6. Staff counts
    staff_res = await db.execute(
        select(func.count(User.id)).where(
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    total_staff = int(staff_res.scalar() or 0)

    return {
        "overview": overview,
        "low_stock_ingredients": low_stock_items,
        "active_kitchen_orders": active_orders,
        "tables_status_breakdown": tables_by_status,
        "recipe_margin_highlights": low_margin_recipes,
        "total_active_staff": total_staff,
    }


def generate_fallback_synthesis(query: str, context: dict[str, Any]) -> str:
    """High-accuracy fallback synthesis using live database context when NIM API is offline."""
    q = query.lower()
    ov = context.get("overview", {})

    if "revenue" in q or "sale" in q or "bill" in q or "money" in q:
        top_items = ov.get("top_selling_items", [])
        items_str = ", ".join([f"{item['name']} ({item['quantity_sold']} sold - ₹{item['total_sales']:.2f})" for item in top_items[:3]]) or "None yet"
        return (
            f"💰 **Revenue & Sales Update**\n\n"
            f"• **Today's Revenue:** ₹{ov.get('today_revenue', 0):,.2f}\n"
            f"• **Paid Bills:** {ov.get('paid_bills_count', 0)}\n"
            f"• **Total Orders Today:** {ov.get('total_orders_today', 0)}\n"
            f"• **Today's Food Waste Cost:** ₹{ov.get('today_waste_cost', 0):,.2f}\n\n"
            f"🏆 **Top Selling Items:**\n{items_str}"
        )

    if "inventory" in q or "stock" in q or "ingredient" in q or "waste" in q:
        low_stock = context.get("low_stock_ingredients", [])
        if low_stock:
            items_fmt = "\n".join([f"  • **{i['name']}**: {i['current_stock']} {i['unit']} (Minimum required: {i['minimum_stock']} {i['unit']})" for i in low_stock])
            return (
                f"📦 **Inventory & Stock Report**\n\n"
                f"⚠️ **Low Stock Alert:** {ov.get('low_stock_count', 0)} ingredient(s) are below threshold:\n"
                f"{items_fmt}\n\n"
                f"• **Today's Waste Impact:** ₹{ov.get('today_waste_cost', 0):,.2f}\n"
                f"💡 *Action recommended:* Reorder critical low-stock ingredients to prevent menu availability outages."
            )
        return (
            f"📦 **Inventory & Stock Report**\n\n"
            f"✅ All ingredient stock levels are currently healthy! (0 items below threshold)\n"
            f"• **Today's Waste Cost:** ₹{ov.get('today_waste_cost', 0):,.2f}"
        )

    if "kitchen" in q or "kds" in q or "prep" in q or "order" in q:
        orders = context.get("active_kitchen_orders", [])
        if orders:
            ord_fmt = "\n".join([f"  • Order #{o['order_number']} — Status: `{o['status'].upper()}` | Placed at {o['created_at']} (Total: ₹{o['total_amount']:.2f})" for o in orders[:5]])
            return (
                f"🍳 **Kitchen & Order Status**\n\n"
                f"• **Active Kitchen Orders:** {ov.get('active_orders_count', 0)}\n"
                f"• **Total Orders Placed Today:** {ov.get('total_orders_today', 0)}\n\n"
                f"📋 **Active Ticket Queue:**\n{ord_fmt}"
            )
        return (
            f"🍳 **Kitchen Status**\n\n"
            f"✅ Kitchen queue is clear! Currently {ov.get('active_orders_count', 0)} active orders in preparation.\n"
            f"• **Total Orders Today:** {ov.get('total_orders_today', 0)}"
        )

    if "table" in q or "seat" in q or "occupancy" in q:
        tb = context.get("tables_status_breakdown", {})
        return (
            f"🪑 **Table & Occupancy Overview**\n\n"
            f"• **Occupancy Rate:** {ov.get('occupancy_rate', 0)}%\n"
            f"• **Occupied Tables:** {ov.get('occupied_tables', 0)} / {ov.get('total_tables', 0)}\n\n"
            f"📊 **Status Breakdown:**\n"
            f"  • Available: {tb.get('available', 0)}\n"
            f"  • Occupied: {tb.get('occupied', 0)}\n"
            f"  • Cleaning Required: {tb.get('cleaning', 0)}\n"
            f"  • Out of Service: {tb.get('out_of_service', 0)}"
        )

    if "recipe" in q or "profit" in q or "margin" in q or "price" in q or "cost" in q:
        margins = context.get("recipe_margin_highlights", [])
        if margins:
            m_fmt = "\n".join([f"  • **{m['menu_item']}**: Selling: ₹{m['selling_price']} | Recipe Cost: ₹{m['cost']} | Margin: `{m['margin_pct']}%` | Suggested 70% Price: ₹{m['suggested_price']}" for m in margins])
            return (
                f"📖 **Recipe Costing & Profitability**\n\n"
                f"🔍 **Recipe Margin Profiler:**\n{m_fmt}\n\n"
                f"💡 *Tip:* Items with low profit margins can be repriced or ingredient portions adjusted to reach target 70% gross margins."
            )

    # General executive summary
    return (
        f"📊 **ResMan OS Executive Overview**\n\n"
        f"• 💰 **Today's Revenue:** ₹{ov.get('today_revenue', 0):,.2f} ({ov.get('paid_bills_count', 0)} paid bills)\n"
        f"• 📝 **Orders Today:** {ov.get('total_orders_today', 0)} total ({ov.get('active_orders_count', 0)} active in kitchen)\n"
        f"• 🪑 **Table Occupancy:** {ov.get('occupancy_rate', 0)}% ({ov.get('occupied_tables', 0)}/{ov.get('total_tables', 0)} occupied)\n"
        f"• 📦 **Stock Alerts:** {ov.get('low_stock_count', 0)} low-stock ingredient(s)\n"
        f"• ⭐ **CSAT Rating:** {ov.get('avg_csat', 0)} / 5.0\n"
        f"• 🗑️ **Today's Waste:** ₹{ov.get('today_waste_cost', 0):,.2f}\n\n"
        f"How else can I assist you with restaurant operations?"
    )


def build_system_prompt(context: dict[str, Any]) -> str:
    """Build system instructions with injected real-time database context."""
    return f"""You are ResMan AI Manager Assistant — an expert restaurant operation AI assistant for ResMan OS.

VERIFIED REAL-TIME RESTAURANT DATA (LIVE DATABASE CONTEXT):
---------------------------------------------------------
{context}
---------------------------------------------------------

STRICT OPERATIONAL DIRECTIVES:
1. You are EXCLUSIVELY a restaurant management assistant.
2. Answer questions ONLY regarding restaurant operations, revenue, orders, inventory, kitchen workflow, table occupancy, staff, recipes, costs, and reviews.
3. If a question is NOT about restaurant operations (e.g. general trivia, coding, weather, political topics, fiction, personal questions), politely refuse by stating:
   "I am designed strictly to assist with ResMan OS restaurant operations and analytics. Please ask a question related to sales, inventory, orders, kitchen status, tables, or staff management."
4. ALWAYS ground your answers in the VERIFIED REAL-TIME RESTAURANT DATA provided above. Be specific with numbers, currency (₹), and percentages.
5. Provide actionable, concise, and structured responses using clear Markdown formatting (bullet points, bold text, clean lists).
"""


async def process_ai_chat(
    db: AsyncSession,
    message: str,
    session_id: str | None = None,
    history: list[AIChatMessage] | None = None,
) -> AIChatResponse:
    """Process manager query, classify intent, pull context, call NIM API or fallback."""
    session_id = session_id or str(uuid.uuid4())
    
    # 1. Guardrail: Check domain restriction
    if not is_restaurant_query(message):
        return AIChatResponse(
            reply=(
                "I am designed strictly to assist with ResMan OS restaurant operations and analytics. "
                "Please ask a question related to sales, revenue, inventory, active orders, kitchen status, table occupancy, or staff management."
            ),
            session_id=session_id,
            suggested_questions=[
                "How is today's revenue performing?",
                "Which ingredients are low on stock?",
                "What is our active kitchen order queue?",
                "What is our current table occupancy rate?",
            ],
            context_summary=None,
        )

    # 2. Gather live context from database
    context = await build_restaurant_live_context(db)

    # 3. Check for NVIDIA NIM API Key
    nim_api_key = os.getenv("NVIDIA_NIM_API_KEY") or os.getenv("NVIDIA_API_KEY")

    reply_text = None
    engine_used = "live_db_fallback"

    logger.info("==================================================")
    logger.info(f"🤖 [AI MANAGER ASSISTANT] Received Query: '{message}'")
    logger.info(f"🔑 API Key Found: {'YES (NVIDIA NIM)' if nim_api_key else 'NO (Using Live DB Fallback)'}")

    if nim_api_key:
        try:
            logger.info(f"🚀 Calling NVIDIA NIM API (Model: {NVIDIA_NIM_MODEL})...")
            system_prompt = build_system_prompt(context)
            messages = [{"role": "system", "content": system_prompt}]
            
            if history:
                for h in history[-4:]: # Include last 4 turns
                    messages.append({"role": h.role, "content": h.content})
                    
            messages.append({"role": "user", "content": message})

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{NVIDIA_NIM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {nim_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": NVIDIA_NIM_MODEL,
                        "messages": messages,
                        "temperature": 0.2,
                        "max_tokens": 1024,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        reply_text = choices[0].get("message", {}).get("content")
                        engine_used = "nvidia_nim"
                        logger.info("✅ NVIDIA NIM API response received successfully (200 OK)")
                else:
                    logger.warning(f"⚠️ NVIDIA NIM API returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"❌ NVIDIA NIM API call failed with exception: {e}")

    # 4. Fallback synthesis if NIM call did not execute or failed
    if not reply_text:
        logger.info("⚡ Processing response via Built-in Live Context Engine...")
        reply_text = generate_fallback_synthesis(message, context)
        engine_used = "live_db_fallback"

    logger.info(f"🏁 Final Engine Used: {engine_used.upper()}")
    logger.info("==================================================")

    # 5. Build relevant suggested follow-up questions
    suggested = [
        "What are our top-selling items today?",
        "Are any ingredients running low on stock?",
        "Show kitchen order queue and prep status",
        "What is our current table occupancy rate?",
    ]

    return AIChatResponse(
        reply=reply_text,
        session_id=session_id,
        engine_used=engine_used,
        suggested_questions=suggested,
        context_summary={
            "today_revenue": context["overview"].get("today_revenue"),
            "active_orders": context["overview"].get("active_orders_count"),
            "low_stock_count": context["overview"].get("low_stock_count"),
            "occupancy_rate": context["overview"].get("occupancy_rate"),
        },
    )
