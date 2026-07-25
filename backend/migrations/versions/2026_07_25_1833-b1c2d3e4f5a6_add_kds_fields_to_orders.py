"""add_kds_fields_to_orders

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-07-25 18:33:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "a9b8c7d6e5f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
    )
    op.add_column(
        "orders",
        sa.Column("estimated_prep_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("estimated_completion_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("is_paused", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "orders",
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_orders_priority", "orders", ["priority"])


def downgrade() -> None:
    op.drop_index("ix_orders_priority", table_name="orders")
    op.drop_column("orders", "paused_at")
    op.drop_column("orders", "is_paused")
    op.drop_column("orders", "estimated_completion_at")
    op.drop_column("orders", "estimated_prep_minutes")
    op.drop_column("orders", "priority")
