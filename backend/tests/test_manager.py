import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.manager import get_recipe_profitability_analysis


@pytest.mark.asyncio
async def test_get_recipe_profitability_analysis_decimal_handling():
    """Verify get_recipe_profitability_analysis correctly handles Decimal current_stock and float division."""
    mock_db = AsyncMock()

    # Mock ingredient with Decimal current_stock & unit_cost
    mock_ingredient = MagicMock()
    mock_ingredient.name = "Chicken"
    mock_ingredient.unit_cost = Decimal("120.50")
    mock_ingredient.current_stock = Decimal("15.500")
    mock_ingredient.unit_of_measure = "kg"

    # Mock recipe ingredient
    mock_recipe_ingredient = MagicMock()
    mock_recipe_ingredient.ingredient = mock_ingredient
    mock_recipe_ingredient.quantity = Decimal("0.500")
    mock_recipe_ingredient.unit_of_measure = "kg"

    # Mock menu item
    mock_menu_item = MagicMock()
    mock_menu_item.name = "Butter Chicken"
    mock_menu_item.price = Decimal("350.00")
    mock_menu_item.is_available = True

    # Mock recipe
    mock_recipe = MagicMock()
    mock_recipe.id = uuid.uuid4()
    mock_recipe.menu_item_id = uuid.uuid4()
    mock_recipe.menu_item = mock_menu_item
    mock_recipe.name = "Butter Chicken Recipe"
    mock_recipe.recipe_ingredients = [mock_recipe_ingredient]

    # Mock scalars result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_recipe]
    mock_db.execute.return_value = mock_result

    analysis = await get_recipe_profitability_analysis(mock_db)

    assert len(analysis) == 1
    item = analysis[0]
    assert item["menu_item_name"] == "Butter Chicken"
    assert item["selling_price"] == 350.0
    assert item["recipe_cost"] == 60.25
    assert item["gross_profit"] == 289.75
    assert item["max_makeable_portions"] == 31  # 15.5 // 0.5 = 31
    assert item["ingredient_breakdown"][0]["current_stock"] == 15.5
