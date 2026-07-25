"""
Pydantic schemas for Table Management API.
"""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

TableStatus = Literal[
    "available",
    "reserved",
    "awaiting_verification",
    "occupied",
    "billing",
    "cleaning",
    "out_of_service",
]

VALID_STATUSES = (
    "available",
    "reserved",
    "awaiting_verification",
    "occupied",
    "billing",
    "cleaning",
    "out_of_service",
)


class TableOut(BaseModel):
    """Table response representation DTO."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    branch_id: uuid.UUID
    table_number: str
    capacity: int
    status: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TableCreate(BaseModel):
    """Payload for creating a new dining table."""

    table_number: Annotated[str, Field(min_length=1, max_length=50)]
    capacity: Annotated[int, Field(ge=1, le=100, description="Number of seats")]
    status: TableStatus = "available"
    description: Annotated[str | None, Field(max_length=500)] = None
    is_active: bool = True

    @field_validator("table_number")
    @classmethod
    def strip_table_number(cls, v: str) -> str:
        return v.strip()


class TableUpdate(BaseModel):
    """Payload for updating an existing dining table."""

    table_number: Annotated[str | None, Field(min_length=1, max_length=50)] = None
    capacity: Annotated[int | None, Field(ge=1, le=100)] = None
    status: TableStatus | None = None
    description: Annotated[str | None, Field(max_length=500)] = None
    is_active: bool | None = None

    @field_validator("table_number")
    @classmethod
    def strip_table_number_optional(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class TableStatusToggle(BaseModel):
    """Payload for updating table status or active state."""

    is_active: bool | None = None
    status: TableStatus | None = None


class TableListResponse(BaseModel):
    """Paginated response wrapper for table list."""

    items: list[TableOut]
    total: int
    page: int
    page_size: int
    total_pages: int
