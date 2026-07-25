import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.order import OrderItem
    from app.models.recipe import Recipe, WasteRecord
    from app.models.restaurant import Branch


class Category(BaseModel, SoftDeleteMixin):
    """Menu category (e.g. Appetizers, Main Course, Drinks)."""

    __tablename__ = "categories"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship(
        "Branch", back_populates="categories"
    )
    menu_items: Mapped[list["MenuItem"]] = relationship(
        "MenuItem", back_populates="category"
    )
    item_categories: Mapped[list["MenuItemCategory"]] = relationship(
        "MenuItemCategory", back_populates="category", cascade="all, delete-orphan"
    )


class MenuItem(BaseModel, SoftDeleteMixin):
    """Individual food or beverage menu item."""

    __tablename__ = "menu_items"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_available: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    is_vegetarian: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_vegan: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_gluten_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    preparation_time_minutes: Mapped[int] = mapped_column(
        Integer, default=15, nullable=False
    )

    # Relationships
    category: Mapped["Category"] = relationship("Category", back_populates="menu_items")
    images: Mapped[list["MenuItemImage"]] = relationship(
        "MenuItemImage", back_populates="menu_item", cascade="all, delete-orphan"
    )
    categories: Mapped[list["MenuItemCategory"]] = relationship(
        "MenuItemCategory", back_populates="menu_item", cascade="all, delete-orphan"
    )
    recipes: Mapped[list["Recipe"]] = relationship(
        "Recipe", back_populates="menu_item", cascade="all, delete-orphan"
    )
    order_items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="menu_item"
    )
    waste_records: Mapped[list["WasteRecord"]] = relationship(
        "WasteRecord", back_populates="menu_item"
    )


class MenuItemImage(BaseModel):
    """Multiple images for a menu item."""

    __tablename__ = "menu_item_images"

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    menu_item: Mapped["MenuItem"] = relationship("MenuItem", back_populates="images")


class MenuItemCategory(BaseModel):
    """Junction table supporting multi-category tagging for menu items."""

    __tablename__ = "menu_item_categories"
    __table_args__ = (
        UniqueConstraint("menu_item_id", "category_id", name="uq_menu_item_category"),
    )

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem", back_populates="categories"
    )
    category: Mapped["Category"] = relationship(
        "Category", back_populates="item_categories"
    )
