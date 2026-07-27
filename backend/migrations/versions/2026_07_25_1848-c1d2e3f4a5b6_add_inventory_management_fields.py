"""add_inventory_management_fields

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-07-25 18:48:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── ingredients table ───────────────────────────────────────────────────
    op.add_column("ingredients", sa.Column("supplier", sa.String(255), nullable=True))
    op.add_column(
        "ingredients",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "ingredients",
        sa.Column("version_id", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index("ix_ingredients_is_active", "ingredients", ["is_active"])

    # ── stock_history table ─────────────────────────────────────────────────
    op.add_column(
        "stock_history",
        sa.Column(
            "previous_quantity", sa.Numeric(12, 3), server_default="0", nullable=False
        ),
    )
    op.add_column(
        "stock_history",
        sa.Column(
            "new_quantity", sa.Numeric(12, 3), server_default="0", nullable=False
        ),
    )
    op.add_column(
        "stock_history",
        sa.Column(
            "action_type", sa.String(50), server_default="adjustment", nullable=False
        ),
    )
    op.add_column(
        "stock_history", sa.Column("invoice_number", sa.String(100), nullable=True)
    )
    op.add_column("stock_history", sa.Column("supplier", sa.String(255), nullable=True))
    op.add_column("stock_history", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column(
        "stock_history",
        sa.Column(
            "recorded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_stock_history_action_type", "stock_history", ["action_type"])
    op.create_index(
        "ix_stock_history_recorded_by_user_id", "stock_history", ["recorded_by_user_id"]
    )

    # ── purchase_history table ──────────────────────────────────────────────
    op.add_column(
        "purchase_history", sa.Column("invoice_number", sa.String(100), nullable=True)
    )
    op.add_column(
        "purchase_history",
        sa.Column(
            "recorded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── waste_records table ─────────────────────────────────────────────────
    op.add_column("waste_records", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("waste_records", "notes")
    op.drop_column("purchase_history", "recorded_by_user_id")
    op.drop_column("purchase_history", "invoice_number")

    op.drop_index("ix_stock_history_recorded_by_user_id", table_name="stock_history")
    op.drop_index("ix_stock_history_action_type", table_name="stock_history")
    op.drop_column("stock_history", "recorded_by_user_id")
    op.drop_column("stock_history", "notes")
    op.drop_column("stock_history", "supplier")
    op.drop_column("stock_history", "invoice_number")
    op.drop_column("stock_history", "action_type")
    op.drop_column("stock_history", "new_quantity")
    op.drop_column("stock_history", "previous_quantity")

    op.drop_index("ix_ingredients_is_active", table_name="ingredients")
    op.drop_column("ingredients", "version_id")
    op.drop_column("ingredients", "is_active")
    op.drop_column("ingredients", "supplier")
