import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.loyalty import CustomerCoupon
    from app.models.order import Order, OrderItem
    from app.models.restaurant import Branch


class Bill(BaseModel, SoftDeleteMixin):
    """Financial billing record for orders."""

    __tablename__ = "bills"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bill_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    discount_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    tip_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="unpaid", nullable=False, index=True
    )  # unpaid, partially_paid, paid, refunded

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="bills")
    items: Mapped[list["BillItem"]] = relationship(
        "BillItem", back_populates="bill", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="bill", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="bill", cascade="all, delete-orphan"
    )
    discounts: Mapped[list["Discount"]] = relationship(
        "Discount", back_populates="bill", cascade="all, delete-orphan"
    )


class BillItem(BaseModel):
    """Itemized snapshot of items included in a bill."""

    __tablename__ = "bill_items"

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    bill: Mapped["Bill"] = relationship("Bill", back_populates="items")
    order_item: Mapped["OrderItem"] = relationship("OrderItem")


class Payment(BaseModel):
    """Payment transaction attempt or settlement for a bill."""

    __tablename__ = "payments"

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_method: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # cash, card, upi, online
    payment_gateway: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # stripe, razorpay, square
    transaction_reference: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending, completed, failed, refunded
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    bill: Mapped["Bill"] = relationship("Bill", back_populates="payments")


class Invoice(BaseModel):
    """Tax invoice document metadata."""

    __tablename__ = "invoices"

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    pdf_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    tax_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    bill: Mapped["Bill"] = relationship("Bill", back_populates="invoices")


class Coupon(BaseModel, SoftDeleteMixin):
    """Promotional campaign coupons and discounts."""

    __tablename__ = "coupons"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # percentage, fixed_amount
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    max_discount_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    valid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    times_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship(
        "Branch", back_populates="coupons"
    )
    customer_coupons: Mapped[list["CustomerCoupon"]] = relationship(
        "CustomerCoupon", back_populates="coupon"
    )
    applied_discounts: Mapped[list["Discount"]] = relationship(
        "Discount", back_populates="coupon"
    )


class Discount(BaseModel):
    """Log of discounts applied to a specific bill."""

    __tablename__ = "discounts"

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    discount_name: Mapped[str] = mapped_column(String(100), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(50), nullable=False)
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amount_saved: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    bill: Mapped["Bill"] = relationship("Bill", back_populates="discounts")
    coupon: Mapped[Optional["Coupon"]] = relationship(
        "Coupon", back_populates="applied_discounts"
    )
