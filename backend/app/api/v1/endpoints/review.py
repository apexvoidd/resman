"""API endpoints for the customer review system."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.review import (
    ManagerReplyInput,
    MenuItemRatingSummary,
    ReviewOut,
    ReviewSubmitInput,
)
from app.services import review as review_service

router = APIRouter(prefix="/reviews", tags=["Customer Reviews"])


@router.post(
    "/submit",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a verified review after paid session",
)
async def submit_review(
    payload: ReviewSubmitInput,
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if not x_session_token:
        raise HTTPException(status_code=400, detail="X-Session-Token header required.")
    return await review_service.submit_review(db, x_session_token, payload)


@router.get(
    "/items/{menu_item_id}",
    response_model=MenuItemRatingSummary,
    status_code=status.HTTP_200_OK,
    summary="Get avg rating and recent reviews for a menu item (public)",
)
async def get_item_reviews(
    menu_item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await review_service.get_reviews_for_item(db, menu_item_id)


@router.get(
    "/manage",
    response_model=list[ReviewOut],
    status_code=status.HTTP_200_OK,
    summary="Manager: list all reviews",
)
async def list_all_reviews(
    include_hidden: bool = True,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await review_service.get_all_reviews_manager(db, include_hidden=include_hidden)


@router.post(
    "/{review_id}/reply",
    response_model=ReviewOut,
    status_code=status.HTTP_200_OK,
    summary="Manager: reply to a review",
)
async def reply_to_review(
    review_id: uuid.UUID,
    payload: ManagerReplyInput,
    current_user: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await review_service.manager_reply(db, review_id, payload, current_user)


@router.patch(
    "/{review_id}/hide",
    response_model=ReviewOut,
    status_code=status.HTTP_200_OK,
    summary="Manager: hide a review",
)
async def hide_review(
    review_id: uuid.UUID,
    current_user: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await review_service.toggle_review_visibility(db, review_id, hide=True, current_user=current_user)


@router.patch(
    "/{review_id}/restore",
    response_model=ReviewOut,
    status_code=status.HTTP_200_OK,
    summary="Manager: restore a hidden review",
)
async def restore_review(
    review_id: uuid.UUID,
    current_user: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await review_service.toggle_review_visibility(db, review_id, hide=False, current_user=current_user)
