import uuid

import pytest
from pydantic import ValidationError

from app.schemas.recipe import RecipeCreatePayload, RecipeIngredientInput


def test_recipe_duplicate_ingredient_validation():
    ing_id = uuid.uuid4()
    with pytest.raises(ValidationError) as exc_info:
        RecipeCreatePayload(
            menu_item_id=uuid.uuid4(),
            name="Butter Chicken",
            ingredients=[
                RecipeIngredientInput(
                    ingredient_id=ing_id, quantity=200, unit_of_measure="g"
                ),
                RecipeIngredientInput(
                    ingredient_id=ing_id, quantity=50, unit_of_measure="g"
                ),
            ],
        )
    assert "Duplicate ingredients" in str(exc_info.value)


def test_recipe_positive_quantity_validation():
    ing_id = uuid.uuid4()
    with pytest.raises(ValidationError):
        RecipeCreatePayload(
            menu_item_id=uuid.uuid4(),
            name="Butter Chicken",
            ingredients=[
                RecipeIngredientInput(
                    ingredient_id=ing_id, quantity=-10, unit_of_measure="g"
                ),
            ],
        )
