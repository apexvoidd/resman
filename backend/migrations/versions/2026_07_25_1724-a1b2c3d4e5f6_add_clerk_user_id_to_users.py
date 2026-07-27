"""add_clerk_user_id_to_users

Revision ID: a1b2c3d4e5f6
Revises: 65ae0d4a711d
Create Date: 2026-07-25 17:24:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "65ae0d4a711d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add clerk_user_id column and relax password_hash to nullable
    op.add_column(
        "users",
        sa.Column("clerk_user_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=True)
    op.alter_column("users", "password_hash", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "password_hash", nullable=False)
    op.drop_index("ix_users_clerk_user_id", table_name="users")
    op.drop_column("users", "clerk_user_id")
