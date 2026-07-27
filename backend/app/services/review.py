"""Service layer for the customer review system."""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.customer import GuestSession
from app.models.menu import MenuItem
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.restaurant import Branch
from app.models.review import Review
from app.models.staff import User
from app.schemas.review import (
    ManagerReplyInput,
    MenuItemRatingSummary,
    ReviewOut,
    ReviewSubmitInput,
)

logger = logging.getLogger("app.services.review")


def _build_review_out(review: Review) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        menu_item_id=review.menu_item_id,
        menu_item_name=review.menu_item.name if review.menu_item else None,
        display_name=review.display_name,
        rating=review.rating,
        comment=review.comment,
        manager_reply=review.manager_reply,
        is_verified=review.is_verified,
        is_hidden=review.is_hidden,
        created_at=review.created_at,
    )


async def submit_review(
    db: AsyncSession,
    session_token: str,
    payload: ReviewSubmitInput,
) -> ReviewOut:
    """
    Submit a review for a menu item.
    Requires: active guest session with orders or completed dining session.
    One review per menu item per session.
    """
    # 1. Validate session
    sess_res = await db.execute(
        select(GuestSession).where(GuestSession.session_token == session_token)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )

    if not session.can_submit_review:
        # Check if session has any non-cancelled orders
        ord_res = await db.execute(
            select(Order).where(
                Order.guest_session_id == session.id,
                Order.status != "cancelled",
                Order.deleted_at.is_(None),
            )
        )
        if ord_res.scalars().first():
            session.can_submit_review = True
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Reviews can only be submitted after ordering food during a dining session.",
            )

    # 2. Check menu item exists
    item_res = await db.execute(
        select(MenuItem).where(
            MenuItem.id == payload.menu_item_id, MenuItem.deleted_at.is_(None)
        )
    )
    menu_item = item_res.scalar_one_or_none()
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    # 3. Verify the item was actually ordered in this session (or at session table)
    ordered_res = await db.execute(
        select(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.guest_session_id == session.id,
            OrderItem.menu_item_id == payload.menu_item_id,
            Order.deleted_at.is_(None),
            Order.status != "cancelled",
        )
    )
    if not ordered_res.scalars().first():
        # Fallback: check table orders if session has table_id
        if session.table_id:
            tbl_ordered_res = await db.execute(
                select(OrderItem)
                .join(Order, Order.id == OrderItem.order_id)
                .where(
                    Order.table_id == session.table_id,
                    OrderItem.menu_item_id == payload.menu_item_id,
                    Order.deleted_at.is_(None),
                    Order.status != "cancelled",
                )
            )
            if not tbl_ordered_res.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You can only review items ordered during your dining session.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only review items ordered during your dining session.",
            )

    # 4. Prevent duplicate review for same item in same session
    dup_res = await db.execute(
        select(Review).where(
            Review.guest_session_id == session.id,
            Review.menu_item_id == payload.menu_item_id,
            Review.deleted_at.is_(None),
        )
    )
    if dup_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted a review for this dish.",
        )

    # 5. Get branch with fallback
    branch = None
    if session.branch_id:
        branch_res = await db.execute(
            select(Branch).where(
                Branch.id == session.branch_id, Branch.deleted_at.is_(None)
            )
        )
        branch = branch_res.scalar_one_or_none()
    if not branch:
        branch_res = await db.execute(
            select(Branch).where(Branch.deleted_at.is_(None)).limit(1)
        )
        branch = branch_res.scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Branch not found."
        )

    # 6. Create review
    review = Review(
        branch_id=branch.id,
        guest_session_id=session.id,
        menu_item_id=payload.menu_item_id,
        display_name=payload.display_name,
        rating=payload.rating,
        comment=payload.comment,
        is_verified=True,
        is_hidden=False,
    )
    db.add(review)
    await db.flush()

    # 7. Notify manager
    db.add(
        Notification(
            recipient_type="manager",
            title=f"⭐ New Review: {menu_item.name}",
            message=f"{payload.display_name or 'Anonymous'} rated '{menu_item.name}' {payload.rating}/5 stars.",
            notification_type="new_review",
            status="unread",
            payload_json={
                "review_id": str(review.id),
                "menu_item_id": str(menu_item.id),
            },
        )
    )

    # 8. Audit log
    db.add(
        AuditLog(
            action="SUBMIT_REVIEW",
            entity="Review",
            entity_id=review.id,
            new_value={
                "rating": payload.rating,
                "menu_item_id": str(payload.menu_item_id),
            },
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.id == review.id)
    )
    return _build_review_out(final_res.scalar_one())


async def get_reviews_for_item(
    db: AsyncSession, menu_item_id: uuid.UUID
) -> MenuItemRatingSummary:
    """Get average rating + recent public reviews for a menu item."""
    agg_res = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.menu_item_id == menu_item_id,
            Review.is_hidden.is_(False),
            Review.deleted_at.is_(None),
        )
    )
    row = agg_res.one()
    avg_rating = float(row[0]) if row[0] is not None else 0.0
    review_count = row[1]

    recent_res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(
            Review.menu_item_id == menu_item_id,
            Review.is_hidden.is_(False),
            Review.deleted_at.is_(None),
        )
        .order_by(Review.created_at.desc())
        .limit(10)
    )
    recent_reviews = [_build_review_out(r) for r in recent_res.scalars().all()]

    return MenuItemRatingSummary(
        menu_item_id=menu_item_id,
        avg_rating=avg_rating,
        review_count=review_count,
        recent_reviews=recent_reviews,
    )


async def get_all_reviews_manager(
    db: AsyncSession,
    include_hidden: bool = True,
) -> list[ReviewOut]:
    """Manager view: all reviews, optionally including hidden ones."""
    q = (
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.deleted_at.is_(None))
    )
    if not include_hidden:
        q = q.where(Review.is_hidden.is_(False))
    q = q.order_by(Review.created_at.desc())
    res = await db.execute(q)
    return [_build_review_out(r) for r in res.scalars().all()]


async def manager_reply(
    db: AsyncSession,
    review_id: uuid.UUID,
    payload: ManagerReplyInput,
    current_user: User,
) -> ReviewOut:
    """Manager posts or updates a reply to a review."""
    res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.id == review_id, Review.deleted_at.is_(None))
    )
    review = res.scalar_one_or_none()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found."
        )

    review.manager_reply = payload.reply
    review.updated_at = datetime.now(UTC)

    db.add(
        AuditLog(
            action="MANAGER_REPLY",
            entity="Review",
            entity_id=review.id,
            actor_id=current_user.id,
            new_value={"reply": payload.reply},
        )
    )

    await db.commit()
    await db.refresh(review)

    final_res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.id == review.id)
    )
    return _build_review_out(final_res.scalar_one())


async def toggle_review_visibility(
    db: AsyncSession,
    review_id: uuid.UUID,
    hide: bool,
    current_user: User,
) -> ReviewOut:
    """Manager hides or restores a review."""
    res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.id == review_id, Review.deleted_at.is_(None))
    )
    review = res.scalar_one_or_none()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found."
        )

    review.is_hidden = hide
    review.updated_at = datetime.now(UTC)

    action = "HIDE_REVIEW" if hide else "RESTORE_REVIEW"
    db.add(
        AuditLog(
            action=action,
            entity="Review",
            entity_id=review.id,
            actor_id=current_user.id,
            new_value={"is_hidden": hide},
        )
    )

    await db.commit()

    final_res = await db.execute(
        select(Review)
        .options(selectinload(Review.menu_item))
        .where(Review.id == review.id)
    )
    return _build_review_out(final_res.scalar_one())
