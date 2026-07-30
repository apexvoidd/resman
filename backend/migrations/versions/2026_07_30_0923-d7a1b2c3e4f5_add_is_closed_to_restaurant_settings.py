"""add_is_closed_to_restaurant_settings

Revision ID: d7a1b2c3e4f5
Revises: c1d2e3f4a5b6
Create Date: 2026-07-30 09:23:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7a1b2c3e4f5"
down_revision: str | None = "c1d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "restaurant_settings",
        sa.Column(
            "is_closed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("restaurant_settings", "is_closed")
