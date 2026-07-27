import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.staff import StaffCreate
from app.services.staff import create_staff


@pytest.mark.asyncio
async def test_create_staff_reactivates_soft_deleted_email():
    """Verify that creating a staff member with a soft-deleted email re-activates and updates the record."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Mock role lookup
    mock_role = MagicMock()
    mock_role.id = uuid.uuid4()
    mock_role.code = "waiter"
    mock_role.name = "Waiter"
    mock_role.description = "Waiter role"

    now = datetime.now(UTC)

    # Mock soft-deleted user
    mock_user = MagicMock()
    mock_user.id = uuid.uuid4()
    mock_user.email = "deleted_staff@example.com"
    mock_user.deleted_at = now
    mock_user.is_active = False
    mock_user.first_name = "Old"
    mock_user.last_name = "User"
    mock_user.user_roles = []
    mock_user.clerk_user_id = None
    mock_user.created_at = now
    mock_user.updated_at = now
    mock_user.phone = None

    async def mock_execute(query):
        query_str = str(query)
        res = MagicMock()
        if "from users" in query_str.lower():
            res.scalar_one_or_none.return_value = mock_user
        elif "from roles" in query_str.lower():
            res.scalars.return_value.all.return_value = [mock_role]
        return res

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    payload = StaffCreate(
        email="deleted_staff@example.com",
        first_name="NewName",
        last_name="NewLast",
        role_codes=["waiter"],
        is_active=True,
    )

    result = await create_staff(mock_db, payload)

    assert mock_user.deleted_at is None
    assert mock_user.is_active is True
    assert mock_user.first_name == "NewName"
    assert result.email == "deleted_staff@example.com"
