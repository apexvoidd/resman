import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.menu import MenuItem
    from app.models.staff import User


class IngredientCategory(BaseModel):
    """Category classification for raw ingredients (e.g., Dairy, Produce, Meats)."""

    __tablename__ = "ingredient_categories"

    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    ingredients: Mapped[list["Ingredient"]] = relationship(
        "Ingredient", back_populates="category"
    )


class Ingredient(BaseModel, SoftDeleteMixin):
    """Raw inventory ingredient items."""

    __tablename__ = "ingredients"

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredient_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    unit_of_measure: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # kg, g, L, ml, pcs
    current_stock: Mapped[float] = mapped_column(
        Numeric(12, 3), default=0.0, nullable=False
    )
    minimum_stock: Mapped[float] = mapped_column(
        Numeric(12, 3), default=0.0, nullable=False
    )
    reorder_level: Mapped[float] = mapped_column(
        Numeric(12, 3), default=0.0, nullable=False
    )
    unit_cost: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    version_id: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    category: Mapped[Optional["IngredientCategory"]] = relationship(
        "IngredientCategory", back_populates="ingredients"
    )
    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="ingredient"
    )
    purchases: Mapped[list["PurchaseHistory"]] = relationship(
        "PurchaseHistory", back_populates="ingredient"
    )
    stock_changes: Mapped[list["StockHistory"]] = relationship(
        "StockHistory", back_populates="ingredient"
    )
    waste_records: Mapped[list["WasteRecord"]] = relationship(
        "WasteRecord", back_populates="ingredient"
    )


class Recipe(BaseModel):
    """Recipe composition for a menu item."""

    __tablename__ = "recipes"

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    yields: Mapped[int] = mapped_column(Numeric(8, 2), default=1.0, nullable=False)

    # Relationships
    menu_item: Mapped["MenuItem"] = relationship("MenuItem", back_populates="recipes")
    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(BaseModel):
    """Junction table detailing exact ingredient quantities per recipe."""

    __tablename__ = "recipe_ingredients"

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    recipe: Mapped["Recipe"] = relationship(
        "Recipe", back_populates="recipe_ingredients"
    )
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient", back_populates="recipe_ingredients"
    )


class PurchaseHistory(BaseModel):
    """Supplier purchase log for raw ingredients."""

    __tablename__ = "purchase_history"

    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient", back_populates="purchases"
    )
    recorded_by: Mapped[Optional["User"]] = relationship("User")


class StockHistory(BaseModel):
    """Audit log for ingredient stock changes."""

    __tablename__ = "stock_history"

    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_quantity: Mapped[float] = mapped_column(
        Numeric(12, 3), default=0.0, nullable=False
    )
    new_quantity: Mapped[float] = mapped_column(
        Numeric(12, 3), default=0.0, nullable=False
    )
    change_amount: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # restock, adjustment_increase, adjustment_decrease, waste, create, edit
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient", back_populates="stock_changes"
    )
    recorded_by: Mapped[Optional["User"]] = relationship("User")


class WasteRecord(BaseModel):
    """Food and ingredient wastage tracking."""

    __tablename__ = "waste_records"

    ingredient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    cost_impact: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    waste_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    ingredient: Mapped[Optional["Ingredient"]] = relationship(
        "Ingredient", back_populates="waste_records"
    )
    menu_item: Mapped[Optional["MenuItem"]] = relationship(
        "MenuItem", back_populates="waste_records"
    )
    recorded_by: Mapped[Optional["User"]] = relationship("User")

