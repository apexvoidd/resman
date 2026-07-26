"""
Pydantic schemas for Staff Management API.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator


class RoleOut(BaseModel):
    """Role information included in staff responses."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    code: str
    description: str | None = None


class StaffOut(BaseModel):
    """Full staff member response DTO."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    is_active: bool
    clerk_user_id: str | None = None
    roles: list[RoleOut] = []
    created_at: datetime
    updated_at: datetime

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class StaffCreate(BaseModel):
    """Payload for creating a new staff member."""

    first_name: Annotated[str, Field(min_length=1, max_length=100)]
    last_name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    phone: Annotated[str | None, Field(max_length=50)] = None
    password: Annotated[str | None, Field(min_length=6, max_length=100)] = None
    role_codes: list[str] = Field(
        min_length=1, description="List of role codes to assign (e.g., ['waiter'])"
    )
    is_active: bool = True

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class StaffUpdate(BaseModel):
    """Payload for updating an existing staff member."""

    first_name: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    last_name: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    email: EmailStr | None = None
    phone: Annotated[str | None, Field(max_length=50)] = None
    role_codes: list[str] | None = Field(
        default=None, description="Updated list of role codes"
    )
    is_active: bool | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_whitespace_optional(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class StaffStatusToggle(BaseModel):
    """Payload for enabling/disabling staff status."""

    is_active: bool


class StaffListResponse(BaseModel):
    """Paginated response wrapper for staff list."""

    items: list[StaffOut]
    total: int
    page: int
    page_size: int
    total_pages: int
