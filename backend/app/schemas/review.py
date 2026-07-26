"""Pydantic schemas for the customer review system."""

import html
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _sanitize(v: str | None) -> str | None:
    if v is None:
        return None
    return html.escape(v.strip())[:2000]


class ReviewSubmitInput(BaseModel):
    """Customer submits a review for one menu item after paying."""
    menu_item_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=2000)
    display_name: str | None = Field(None, max_length=100)

    @field_validator("comment", mode="before")
    @classmethod
    def sanitize_comment(cls, v: str | None) -> str | None:
        return _sanitize(v)

    @field_validator("display_name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return html.escape(v.strip())[:100] or None


class ReviewOut(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID | None
    menu_item_name: str | None = None
    display_name: str | None
    rating: int
    comment: str | None
    manager_reply: str | None
    is_verified: bool
    is_hidden: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ManagerReplyInput(BaseModel):
    reply: str = Field(..., min_length=1, max_length=1000)

    @field_validator("reply", mode="before")
    @classmethod
    def sanitize_reply(cls, v: str) -> str:
        return html.escape(v.strip())[:1000]


class MenuItemRatingSummary(BaseModel):
    menu_item_id: uuid.UUID
    avg_rating: float
    review_count: int
    recent_reviews: list[ReviewOut] = []
