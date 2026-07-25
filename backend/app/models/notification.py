import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.staff import User


class Notification(BaseModel):
    """Notification model supporting multi-role recipients and status tracking."""

    __tablename__ = "notifications"

    recipient_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # customer, waiter, kitchen, manager, admin
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    recipient_customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # order_update, waitlist_alert, system_alert
    status: Mapped[str] = mapped_column(
        String(50), default="unread", nullable=False, index=True
    )  # unread, read, archived
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    recipient_user: Mapped[Optional["User"]] = relationship("User")
    recipient_customer: Mapped[Optional["Customer"]] = relationship("Customer")
