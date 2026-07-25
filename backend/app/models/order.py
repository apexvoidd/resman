from datetime import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.billing import Bill
    from app.models.customer import Customer, GuestSession
    from app.models.menu import MenuItem
    from app.models.restaurant import Branch
    from app.models.staff import User
    from app.models.table import DiningTable


class Order(BaseModel, SoftDeleteMixin):
    """Primary customer order transaction record."""

    __tablename__ = "orders"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
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
    guest_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("guest_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    order_type: Mapped[str] = mapped_column(
        String(50), default="dine_in", nullable=False
    )  # dine_in, takeaway, delivery
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending, accepted, preparing, ready, served, completed, cancelled, paused
    priority: Mapped[str] = mapped_column(
        String(20), default="normal", nullable=False, index=True
    )  # normal, high, urgent
    estimated_prep_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_completion_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paused_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    discount_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    final_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch", back_populates="orders")
    table: Mapped[Optional["DiningTable"]] = relationship(
        "DiningTable", back_populates="orders"
    )
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="orders"
    )
    guest_session: Mapped[Optional["GuestSession"]] = relationship(
        "GuestSession", back_populates="orders"
    )
    waiter: Mapped[Optional["User"]] = relationship("User")
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    status_history: Mapped[list["OrderStatusHistory"]] = relationship(
        "OrderStatusHistory", back_populates="order", cascade="all, delete-orphan"
    )
    kitchen_tickets: Mapped[list["KitchenTicket"]] = relationship(
        "KitchenTicket", back_populates="order", cascade="all, delete-orphan"
    )
    bills: Mapped[list["Bill"]] = relationship("Bill", back_populates="order")


class OrderItem(BaseModel):
    """Line item contained within an order."""

    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending, preparing, ready, served, cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem", back_populates="order_items"
    )
    special_instructions: Mapped[list["SpecialInstruction"]] = relationship(
        "SpecialInstruction", back_populates="order_item", cascade="all, delete-orphan"
    )


class OrderStatusHistory(BaseModel):
    """Audit trail tracking transitions of order statuses."""

    __tablename__ = "order_status_history"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="status_history")
    changed_by: Mapped[Optional["User"]] = relationship("User")


class KitchenTicket(BaseModel):
    """KDS (Kitchen Display System) tickets generated for preparation stations."""

    __tablename__ = "kitchen_tickets"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticket_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    station: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # grill, bar, pastry, main
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending, in_progress, completed

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="kitchen_tickets")


class SpecialInstruction(BaseModel):
    """Custom modifiers and special requests for specific order items."""

    __tablename__ = "special_instructions"

    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instruction_text: Mapped[str] = mapped_column(String(255), nullable=False)
    extra_cost: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )

    # Relationships
    order_item: Mapped["OrderItem"] = relationship(
        "OrderItem", back_populates="special_instructions"
    )
