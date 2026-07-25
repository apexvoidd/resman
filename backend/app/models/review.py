import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.order import Order
    from app.models.restaurant import Branch
    from app.models.staff import User


class Review(BaseModel, SoftDeleteMixin):
    """Customer ratings and review feedback."""

    __tablename__ = "reviews"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 1 to 5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch", back_populates="reviews")
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="reviews"
    )
    order: Mapped[Optional["Order"]] = relationship("Order")
    images: Mapped[list["ReviewImage"]] = relationship(
        "ReviewImage", back_populates="review", cascade="all, delete-orphan"
    )
    reactions: Mapped[list["ReviewReaction"]] = relationship(
        "ReviewReaction", back_populates="review", cascade="all, delete-orphan"
    )


class ReviewImage(BaseModel):
    """Images attached to customer reviews."""

    __tablename__ = "review_images"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(1024), nullable=False)

    # Relationships
    review: Mapped["Review"] = relationship("Review", back_populates="images")


class ReviewReaction(BaseModel):
    """Reactions (helpful, flag, like) on customer reviews."""

    __tablename__ = "review_reactions"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reaction_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # like, helpful, flag

    # Relationships
    review: Mapped["Review"] = relationship("Review", back_populates="reactions")
    user: Mapped[Optional["User"]] = relationship("User")
    customer: Mapped[Optional["Customer"]] = relationship("Customer")
