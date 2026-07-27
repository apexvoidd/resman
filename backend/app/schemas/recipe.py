"""
Pydantic schemas for Recipe Management, Ingredient Composition, and Stock Deductions.
"""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RecipeIngredientInput(BaseModel):
    ingredient_id: uuid.UUID
    quantity: float = Field(
        ...,
        gt=0.0,
        description="Required quantity per portion must be strictly positive",
    )
    unit_of_measure: Literal["kg", "g", "L", "ml", "pcs"] = Field(
        ..., description="Unit of measurement"
    )


class RecipeIngredientOut(BaseModel):
    id: uuid.UUID
    ingredient_id: uuid.UUID
    ingredient_name: str
    quantity: float
    unit_of_measure: str
    current_stock: float
    minimum_stock: float
    unit_cost: float

    model_config = ConfigDict(from_attributes=True)


class RecipeCreatePayload(BaseModel):
    menu_item_id: uuid.UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    instructions: Annotated[str | None, Field(max_length=2000)] = None
    yields: float = Field(default=1.0, gt=0.0)
    ingredients: list[RecipeIngredientInput] = Field(..., min_length=1)

    @field_validator("ingredients")
    @classmethod
    def validate_no_duplicate_ingredients(
        cls, value: list[RecipeIngredientInput]
    ) -> list[RecipeIngredientInput]:
        seen = set()
        for item in value:
            if item.ingredient_id in seen:
                raise ValueError(
                    "Duplicate ingredients in a single recipe are not allowed."
                )
            seen.add(item.ingredient_id)
        return value


class RecipeOut(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    menu_item_name: str | None = None
    name: str
    instructions: str | None = None
    yields: float
    ingredients: list[RecipeIngredientOut]
    max_makeable_portions: int
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
