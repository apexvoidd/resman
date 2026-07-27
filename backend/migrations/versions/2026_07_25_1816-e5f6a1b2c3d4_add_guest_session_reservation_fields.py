"""add_guest_session_reservation_fields

Revision ID: e5f6a1b2c3d4
Revises: c3f8a1e92b45
Create Date: 2026-07-25 18:16:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a1b2c3d4"
down_revision: str | None = "c3f8a1e92b45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guest_sessions", sa.Column("guest_name", sa.String(255), nullable=True)
    )
    op.add_column(
        "guest_sessions", sa.Column("guest_email", sa.String(255), nullable=True)
    )
    op.add_column(
        "guest_sessions", sa.Column("guest_count", sa.Integer(), nullable=True)
    )
    op.add_column(
        "guest_sessions",
        sa.Column("reservation_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "guest_sessions",
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("guest_sessions", "cooldown_until")
    op.drop_column("guest_sessions", "reservation_expires_at")
    op.drop_column("guest_sessions", "guest_count")
    op.drop_column("guest_sessions", "guest_email")
    op.drop_column("guest_sessions", "guest_name")
