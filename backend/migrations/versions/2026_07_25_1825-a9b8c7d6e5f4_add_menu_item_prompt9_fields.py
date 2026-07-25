"""add_menu_item_prompt9_fields

Revision ID: a9b8c7d6e5f4
Revises: f1e2d3c4b5a6
Create Date: 2026-07-25 18:25:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: str | None = "f1e2d3c4b5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "menu_items",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "menu_items",
        sa.Column("is_jain", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "menu_items",
        sa.Column("spicy_level", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "menu_items",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "menu_items",
        sa.Column("image_url", sa.String(1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("menu_items", "image_url")
    op.drop_column("menu_items", "display_order")
    op.drop_column("menu_items", "spicy_level")
    op.drop_column("menu_items", "is_jain")
    op.drop_column("menu_items", "is_featured")
