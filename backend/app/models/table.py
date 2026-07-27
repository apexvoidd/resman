import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.customer import Customer, GuestSession
    from app.models.order import Order
    from app.models.restaurant import Branch


class DiningTable(BaseModel, SoftDeleteMixin):
    """Physical dining table layout for branches."""

    __tablename__ = "dining_tables"
    __table_args__ = (
        UniqueConstraint("branch_id", "table_number", name="uq_branch_table_number"),
    )

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    table_number: Mapped[str] = mapped_column(String(50), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    status: Mapped[str] = mapped_column(
        String(50), default="available", nullable=False, index=True
    )
    qr_identifier: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        default=lambda: f"qr_{uuid.uuid4().hex}",
    )
    location_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch", back_populates="tables")
    guest_sessions: Mapped[list["GuestSession"]] = relationship(
        "GuestSession", back_populates="table"
    )
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="table")


class QueueEntry(BaseModel):
    """Waitlist queue entry for walk-in or waiting guests."""

    __tablename__ = "queue_entries"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    guest_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("guest_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    guest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        String(50), default="waiting", nullable=False, index=True
    )  # waiting, seated, cancelled, no_show
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    current_position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    estimated_wait_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch")
    guest_session: Mapped[Optional["GuestSession"]] = relationship("GuestSession")
    customer: Mapped[Optional["Customer"]] = relationship("Customer")
