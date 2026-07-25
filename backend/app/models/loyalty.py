import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.billing import Coupon
    from app.models.customer import Customer
    from app.models.order import Order


class RewardPoint(BaseModel):
    """Customer loyalty points ledger summary."""

    __tablename__ = "reward_points"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    current_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    customer: Mapped["Customer"] = relationship(
        "Customer", back_populates="reward_point"
    )
    transactions: Mapped[list["RewardTransaction"]] = relationship(
        "RewardTransaction", back_populates="reward_point", cascade="all, delete-orphan"
    )


class RewardTransaction(BaseModel):
    """Transaction audit log for earned/redeemed reward points."""

    __tablename__ = "reward_transactions"

    reward_point_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reward_points.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    transaction_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # earned, redeemed, expired, adjusted
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    reward_point: Mapped["RewardPoint"] = relationship(
        "RewardPoint", back_populates="transactions"
    )
    order: Mapped[Optional["Order"]] = relationship("Order")


class CustomerCoupon(BaseModel):
    """Coupons assigned to or claimed by individual customers."""

    __tablename__ = "customer_coupons"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coupon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_used: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="coupons")
    coupon: Mapped["Coupon"] = relationship("Coupon", back_populates="customer_coupons")
