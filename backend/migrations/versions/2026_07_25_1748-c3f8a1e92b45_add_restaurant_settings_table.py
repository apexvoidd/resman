"""add_restaurant_settings_table

Revision ID: c3f8a1e92b45
Revises: a1b2c3d4e5f6
Create Date: 2026-07-25 17:48:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3f8a1e92b45"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "restaurant_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Identity / Fiscal
        sa.Column("gst_number", sa.String(50), nullable=True),
        # Locale
        sa.Column("currency", sa.String(10), nullable=False, server_default="INR"),
        sa.Column("timezone", sa.String(100), nullable=False, server_default="Asia/Kolkata"),
        # Financial percentages
        sa.Column("tax_percentage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("service_charge_percentage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        # Operational timeouts (minutes)
        sa.Column("reservation_timeout_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("queue_timeout_minutes", sa.Integer(), nullable=False, server_default="30"),
        # Operating hours stored as HH:MM strings
        sa.Column("opening_time", sa.String(5), nullable=True),
        sa.Column("closing_time", sa.String(5), nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_restaurant_settings_id", "restaurant_settings", ["id"])
    op.create_index(
        "ix_restaurant_settings_restaurant_id",
        "restaurant_settings",
        ["restaurant_id"],
    )
    op.create_unique_constraint(
        "uq_restaurant_settings_restaurant",
        "restaurant_settings",
        ["restaurant_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_restaurant_settings_restaurant", "restaurant_settings", type_="unique"
    )
    op.drop_index("ix_restaurant_settings_restaurant_id", table_name="restaurant_settings")
    op.drop_index("ix_restaurant_settings_id", table_name="restaurant_settings")
    op.drop_table("restaurant_settings")
