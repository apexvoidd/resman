"""
Pydantic schemas for Customer Cart and Order placement.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(..., ge=1, le=50, description="Quantity must be at least 1")
    special_instructions: Annotated[str | None, Field(max_length=255)] = None

    @field_validator("special_instructions")
    @classmethod
    def strip_instructions(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class OrderCreate(BaseModel):
    items: Annotated[list[OrderItemCreate], Field(min_length=1, description="Cart must contain at least one item")]
    notes: Annotated[str | None, Field(max_length=500)] = None
    idempotency_key: Annotated[str | None, Field(max_length=100)] = None


class OrderItemUpdate(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(..., ge=1, le=50)
    special_instructions: Annotated[str | None, Field(max_length=255)] = None


class OrderUpdate(BaseModel):
    items: Annotated[list[OrderItemUpdate], Field(min_length=1)]
    notes: Annotated[str | None, Field(max_length=500)] = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    menu_item_id: uuid.UUID
    menu_item_name: str | None = None
    quantity: int
    unit_price: float
    total_price: float
    special_instructions: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_number: str
    status: str
    table_id: uuid.UUID | None = None
    table_number: str | None = None
    total_amount: float
    tax_amount: float
    discount_amount: float
    final_amount: float
    notes: str | None = None
    items: list[OrderItemOut]
    can_edit: bool = False
    can_cancel: bool = False
    status_message: str
    created_at: datetime
    updated_at: datetime
