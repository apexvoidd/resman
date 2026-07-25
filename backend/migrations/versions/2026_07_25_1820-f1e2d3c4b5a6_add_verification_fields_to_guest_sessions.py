"""add_verification_fields_to_guest_sessions

Revision ID: f1e2d3c4b5a6
Revises: e5f6a1b2c3d4
Create Date: 2026-07-25 18:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1e2d3c4b5a6"
down_revision: str | None = "e5f6a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guest_sessions",
        sa.Column(
            "verification_status",
            sa.String(50),
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column(
        "guest_sessions",
        sa.Column(
            "verification_requested_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "guest_sessions",
        sa.Column("rejection_reason", sa.String(500), nullable=True),
    )
    op.add_column(
        "guest_sessions",
        sa.Column("occupied_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_guest_sessions_verification_status",
        "guest_sessions",
        ["verification_status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_guest_sessions_verification_status", table_name="guest_sessions"
    )
    op.drop_column("guest_sessions", "occupied_at")
    op.drop_column("guest_sessions", "rejection_reason")
    op.drop_column("guest_sessions", "verification_requested_at")
    op.drop_column("guest_sessions", "verification_status")
