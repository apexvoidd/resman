"""
Pydantic DTO schemas for Category and Menu Item management.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --- CATEGORY SCHEMAS ---


class CategoryOut(BaseModel):
    """Category response representation DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoryCreate(BaseModel):
    """Payload for creating a new menu category."""

    name: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str | None, Field(max_length=500)] = None
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class CategoryUpdate(BaseModel):
    """Payload for updating an existing category."""

    name: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    description: Annotated[str | None, Field(max_length=500)] = None
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name_optional(cls, v: str | None) -> str | None:
        return v.strip() if v else v


# --- MENU ITEM SCHEMAS ---


class MenuItemOut(BaseModel):
    """Menu item response representation DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str | None = None
    name: str
    description: str | None = None
    price: float
    preparation_time_minutes: int
    image_url: str | None = None
    is_available: bool
    is_featured: bool
    is_vegetarian: bool
    is_vegan: bool
    is_jain: bool
    spicy_level: int
    display_order: int
    average_rating: float | None = None
    total_ratings: int = 0
    created_at: datetime
    updated_at: datetime


class MenuItemCreate(BaseModel):
    """Payload for creating a new menu item."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    category_id: uuid.UUID
    description: Annotated[str | None, Field(max_length=1000)] = None
    price: float = Field(
        ..., gt=0, description="Selling price (must be greater than 0)"
    )
    preparation_time_minutes: int = Field(default=15, ge=1, le=240)
    image_url: str | None = None
    is_available: bool = True
    is_featured: bool = False
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_jain: bool = False
    spicy_level: int = Field(default=0, ge=0, le=5)
    display_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class MenuItemUpdate(BaseModel):
    """Payload for updating an existing menu item."""

    name: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    category_id: uuid.UUID | None = None
    description: Annotated[str | None, Field(max_length=1000)] = None
    price: float | None = Field(default=None, gt=0)
    preparation_time_minutes: int | None = Field(default=None, ge=1, le=240)
    image_url: str | None = None
    is_available: bool | None = None
    is_featured: bool | None = None
    is_vegetarian: bool | None = None
    is_vegan: bool | None = None
    is_jain: bool | None = None
    spicy_level: int | None = Field(default=None, ge=0, le=5)
    display_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def strip_name_optional(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class MenuItemListResponse(BaseModel):
    """Paginated menu item list response wrapper."""

    items: list[MenuItemOut]
    total: int
    page: int
    page_size: int
    total_pages: int
