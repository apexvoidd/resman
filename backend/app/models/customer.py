import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.loyalty import CustomerCoupon, RewardPoint
    from app.models.order import Order
    from app.models.restaurant import Branch
    from app.models.review import Review
    from app.models.table import DiningTable


class Customer(BaseModel, SoftDeleteMixin):
    """Registered or recognized customer profile."""

    __tablename__ = "customers"

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    phone: Mapped[str | None] = mapped_column(
        String(50), unique=True, nullable=True, index=True
    )
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    accounts: Mapped[list["CustomerAccount"]] = relationship(
        "CustomerAccount", back_populates="customer", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["GuestSession"]] = relationship(
        "GuestSession", back_populates="customer"
    )
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="customer")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="customer")
    reward_point: Mapped[Optional["RewardPoint"]] = relationship(
        "RewardPoint", back_populates="customer", uselist=False
    )
    coupons: Mapped[list["CustomerCoupon"]] = relationship(
        "CustomerCoupon", back_populates="customer"
    )


class GuestSession(BaseModel):
    """Guest session model allowing order placement without mandatory registration."""

    __tablename__ = "guest_sessions"

    session_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dining_tables.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reservation_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cooldown_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verification_status: Mapped[str] = mapped_column(
        String(50), default="none", nullable=False, index=True
    )  # none, awaiting_verification, confirmed, rejected
    verification_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    occupied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship("Branch")
    table: Mapped[Optional["DiningTable"]] = relationship(
        "DiningTable", back_populates="guest_sessions"
    )
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="sessions"
    )
    orders: Mapped[list["Order"]] = relationship(
        "Order", back_populates="guest_session"
    )


class CustomerAccount(BaseModel):
    """OAuth and third-party login providers linked to a customer."""

    __tablename__ = "customer_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_provider_user_id"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # google, apple, facebook
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="accounts")
