import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.billing import Coupon
    from app.models.menu import Category
    from app.models.order import Order
    from app.models.review import Review
    from app.models.settings import RestaurantSettings
    from app.models.staff import UserRole
    from app.models.table import DiningTable


class Restaurant(BaseModel, SoftDeleteMixin):
    """SaaS Tenant model representing a restaurant enterprise."""

    __tablename__ = "restaurants"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    # Relationships
    branches: Mapped[list["Branch"]] = relationship(
        "Branch", back_populates="restaurant", cascade="all, delete-orphan"
    )
    settings: Mapped["RestaurantSettings | None"] = relationship(
        "RestaurantSettings",
        back_populates="restaurant",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Branch(BaseModel, SoftDeleteMixin):
    """Branch location belonging to a restaurant."""

    __tablename__ = "branches"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    # Relationships
    restaurant: Mapped["Restaurant"] = relationship(
        "Restaurant", back_populates="branches"
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole", back_populates="branch"
    )
    tables: Mapped[list["DiningTable"]] = relationship(
        "DiningTable", back_populates="branch", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(
        "Category", back_populates="branch", cascade="all, delete-orphan"
    )
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="branch")
    coupons: Mapped[list["Coupon"]] = relationship("Coupon", back_populates="branch")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="branch")
