"""
Table Management service layer for DB operations and Waiter Verification workflows.
"""

import logging
import math
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.audit import AuditLog
from app.models.customer import GuestSession
from app.models.notification import Notification
from app.models.restaurant import Branch, Restaurant
from app.models.staff import User
from app.models.table import DiningTable
from app.schemas.guest import PendingVerificationTable, VerificationActionInput
from app.schemas.table import (
    TableCreate,
    TableListResponse,
    TableOut,
    TableUpdate,
)

logger = logging.getLogger("app.services.table")


def _build_table_out(table: DiningTable) -> TableOut:
    """Map DiningTable ORM model to TableOut DTO."""
    return TableOut(
        id=table.id,
        branch_id=table.branch_id,
        table_number=table.table_number,
        capacity=table.capacity,
        status=table.status,
        description=table.location_description,
        is_active=table.is_active,
        created_at=table.created_at,
        updated_at=table.updated_at,
    )


async def get_or_create_default_branch(db: AsyncSession) -> Branch:
    """
    Returns the first active branch, creating a default restaurant and branch
    if none exists yet.
    """
    result = await db.execute(select(Branch).where(Branch.is_active.is_(True)).limit(1))
    branch = result.scalar_one_or_none()
    if branch is not None:
        return branch

    res_result = await db.execute(
        select(Restaurant).where(Restaurant.is_active.is_(True)).limit(1)
    )
    restaurant = res_result.scalar_one_or_none()
    if restaurant is None:
        restaurant = Restaurant(
            name="Main Restaurant",
            currency="INR",
            timezone="Asia/Kolkata",
            is_active=True,
        )
        db.add(restaurant)
        await db.flush()

    branch = Branch(
        restaurant_id=restaurant.id,
        name="Main Branch",
        is_active=True,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def get_table_list(
    db: AsyncSession,
    *,
    search: str | None = None,
    table_status: str | None = None,
    min_capacity: int | None = None,
    exact_capacity: int | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 50,
) -> TableListResponse:
    """
    Fetch paginated dining tables with search and status/capacity filters.
    Only non-deleted tables (`deleted_at is None`) are returned.
    """
    branch = await get_or_create_default_branch(db)

    query = select(DiningTable).where(
        DiningTable.branch_id == branch.id,
        DiningTable.deleted_at.is_(None),
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(DiningTable.table_number.ilike(term))

    if table_status and table_status.strip():
        query = query.where(DiningTable.status == table_status.strip())

    if exact_capacity is not None:
        query = query.where(DiningTable.capacity == exact_capacity)
    elif min_capacity is not None:
        query = query.where(DiningTable.capacity >= min_capacity)

    if is_active is not None:
        query = query.where(DiningTable.is_active.is_(is_active))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    query = (
        query.order_by(DiningTable.table_number.asc()).offset(offset).limit(page_size)
    )

    result = await db.execute(query)
    tables = result.scalars().all()

    items = [_build_table_out(t) for t in tables]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return TableListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_table_by_id(db: AsyncSession, table_id: uuid.UUID) -> TableOut:
    """Fetch single dining table by UUID."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )
    return _build_table_out(table)


async def create_table(db: AsyncSession, payload: TableCreate) -> TableOut:
    """Create a new dining table."""
    branch = await get_or_create_default_branch(db)

    existing = await db.execute(
        select(DiningTable).where(
            DiningTable.branch_id == branch.id,
            DiningTable.table_number.ilike(payload.table_number),
            DiningTable.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Table number '{payload.table_number}' already exists.",
        )

    table = DiningTable(
        branch_id=branch.id,
        table_number=payload.table_number,
        capacity=payload.capacity,
        status=payload.status,
        location_description=payload.description,
        is_active=payload.is_active,
        qr_identifier=f"qr_{uuid.uuid4().hex}",
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)

    return _build_table_out(table)


async def update_table(
    db: AsyncSession, table_id: uuid.UUID, payload: TableUpdate
) -> TableOut:
    """Update an existing dining table's details."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    if (
        payload.table_number
        and payload.table_number.lower() != table.table_number.lower()
    ):
        existing = await db.execute(
            select(DiningTable).where(
                DiningTable.branch_id == table.branch_id,
                DiningTable.table_number.ilike(payload.table_number),
                DiningTable.id != table_id,
                DiningTable.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Table number '{payload.table_number}' already exists.",
            )
        table.table_number = payload.table_number

    if payload.capacity is not None:
        table.capacity = payload.capacity
    if payload.status is not None:
        table.status = payload.status
    if payload.description is not None:
        table.location_description = payload.description
    if payload.is_active is not None:
        table.is_active = payload.is_active

    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)


async def toggle_table_status(
    db: AsyncSession,
    table_id: uuid.UUID,
    *,
    is_active: bool | None = None,
    table_status: str | None = None,
) -> TableOut:
    """Toggle table active status or update table operational status."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    if is_active is not None:
        table.is_active = is_active
        if not is_active:
            table.status = "out_of_service"

    if table_status is not None:
        table.status = table_status

    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)


async def delete_table(db: AsyncSession, table_id: uuid.UUID) -> None:
    """Soft delete a dining table by setting deleted_at timestamp."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
        )
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    table.deleted_at = datetime.now(UTC)
    table.is_active = False
    table.status = "out_of_service"
    await db.commit()


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def get_pending_verifications(db: AsyncSession) -> list[PendingVerificationTable]:
    """Fetch all tables currently awaiting waiter verification."""
    now = datetime.now(UTC)
    branch = await get_or_create_default_branch(db)

    # Release any expired reservations so tables don't stay stuck
    from app.services.guest import release_expired_reservations

    try:
        await release_expired_reservations(db, branch.id)
    except Exception:
        pass

    result = await db.execute(
        select(DiningTable, GuestSession)
        .join(GuestSession, GuestSession.table_id == DiningTable.id)
        .where(
            DiningTable.branch_id == branch.id,
            DiningTable.deleted_at.is_(None),
            DiningTable.status == "awaiting_verification",
        )
        .order_by(DiningTable.table_number.asc())
    )
    rows = result.all()

    out: list[PendingVerificationTable] = []
    for tbl, sess in rows:
        elapsed = 0
        req_at = _ensure_utc(sess.verification_requested_at)
        if req_at:
            elapsed = int((now - req_at).total_seconds())

        out.append(
            PendingVerificationTable(
                table_id=tbl.id,
                table_number=tbl.table_number,
                capacity=tbl.capacity,
                guest_session_id=sess.id,
                guest_name=sess.guest_name,
                guest_count=sess.guest_count or 1,
                verification_requested_at=sess.verification_requested_at,
                time_elapsed_seconds=max(0, elapsed),
            )
        )

    # Trigger automatic 3-minute no-order check while querying
    try:
        await check_no_order_reminders(db)
    except Exception as exc:
        logger.warning("Skipped no-order reminder check: %s", exc)

    return out


async def verify_customer_arrival(
    db: AsyncSession,
    table_id: uuid.UUID,
    payload: VerificationActionInput,
    current_user: User,
) -> TableOut:
    """
    Waiter confirms or rejects customer arrival:
    - If confirm: table -> 'occupied', guest_session -> 'confirmed', menu unlocked.
    - If reject: table -> 'reserved', guest_session -> 'rejected' with reason.
    """
    now = datetime.now(UTC)

    stmt = select(DiningTable).where(
        DiningTable.id == table_id, DiningTable.deleted_at.is_(None)
    )
    if not settings.DATABASE_URL.startswith("sqlite"):
        stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table with ID '{table_id}' not found.",
        )

    if table.status != "awaiting_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table.table_number} is in status '{table.status}' and not awaiting verification.",
        )

    sess_res = await db.execute(
        select(GuestSession).where(
            GuestSession.table_id == table.id,
            GuestSession.is_active == True,  # noqa: E712
        )
    )
    sess = sess_res.scalar_one_or_none()

    if payload.action == "confirm":
        table.status = "occupied"
        if sess:
            sess.verification_status = "confirmed"
            sess.occupied_at = now
            sess.rejection_reason = None

        db.add(
            AuditLog(
                user_id=current_user.id,
                action="VERIFY_ARRIVAL_CONFIRMED",
                entity="DiningTable",
                entity_id=table.id,
                old_value={"status": "awaiting_verification"},
                new_value={
                    "status": "occupied",
                    "waiter_user_id": str(current_user.id),
                },
            )
        )
        staff_name = getattr(
            current_user, "full_name", getattr(current_user, "email", "Staff")
        )
        db.add(
            Notification(
                recipient_type="manager",
                title=f"Table {table.table_number} Seated",
                message=f"Staff member {staff_name} confirmed guest arrival for Table {table.table_number}.",
                notification_type="arrival_confirmed",
                status="unread",
                payload_json={
                    "table_id": str(table.id),
                    "table_number": table.table_number,
                },
            )
        )
    else:  # reject
        table.status = "reserved"
        if sess:
            sess.verification_status = "rejected"
            sess.rejection_reason = (
                payload.reason or "Arrival verification rejected by staff member."
            )

        db.add(
            AuditLog(
                user_id=current_user.id,
                action="VERIFY_ARRIVAL_REJECTED",
                entity="DiningTable",
                entity_id=table.id,
                old_value={"status": "awaiting_verification"},
                new_value={"status": "reserved", "reason": payload.reason},
            )
        )

    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)


async def check_no_order_reminders(db: AsyncSession) -> None:
    """
    Automatic 3-minute reminder:
    If a table has been occupied for 3+ minutes and no order is placed,
    send a reminder notification to waiters.
    """
    now = datetime.now(UTC)
    threshold = now - timedelta(minutes=3)

    result = await db.execute(
        select(GuestSession, DiningTable)
        .join(DiningTable, DiningTable.id == GuestSession.table_id)
        .where(
            GuestSession.verification_status == "confirmed",
            GuestSession.occupied_at.is_not(None),
            GuestSession.occupied_at <= threshold,
            DiningTable.status == "occupied",
        )
    )
    occupied_sessions = result.all()

    for sess, tbl in occupied_sessions:
        # Check existing 3-minute notification to avoid duplicates
        existing_notif = await db.execute(
            select(Notification).where(
                Notification.notification_type == "no_order_reminder",
                Notification.payload_json["table_id"].as_string() == str(tbl.id),
            )
        )
        if existing_notif.scalar_one_or_none() is None:
            db.add(
                Notification(
                    recipient_type="waiter",
                    title=f"3-Min Order Alert: Table {tbl.table_number}",
                    message=f"Table {tbl.table_number} ({sess.guest_name or 'Guest'}) has been occupied for over 3 minutes with no order placed.",
                    notification_type="no_order_reminder",
                    status="unread",
                    payload_json={
                        "table_id": str(tbl.id),
                        "table_number": tbl.table_number,
                    },
                )
            )
    await db.commit()


async def get_cleaning_queue(db: AsyncSession) -> list[TableOut]:
    """Fetch all tables currently in 'cleaning' status."""
    branch = await get_or_create_default_branch(db)
    result = await db.execute(
        select(DiningTable)
        .where(
            DiningTable.branch_id == branch.id,
            DiningTable.status == "cleaning",
            DiningTable.deleted_at.is_(None),
        )
        .order_by(DiningTable.table_number.asc())
    )
    tables = result.scalars().all()
    return [_build_table_out(t) for t in tables]


async def mark_table_clean(
    db: AsyncSession, table_id: uuid.UUID, current_user: User
) -> TableOut:
    """Cleaning staff marks table as clean — sets status back to available."""
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.id == table_id,
            DiningTable.deleted_at.is_(None),
        )
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_id}' not found.",
        )
    if table.status != "cleaning":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table.table_number} is '{table.status}', not in cleaning status.",
        )

    table.status = "available"

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="TABLE_MARKED_CLEAN",
            entity="DiningTable",
            entity_id=table.id,
            old_value={"status": "cleaning"},
            new_value={"status": "available"},
        )
    )
    await db.commit()
    await db.refresh(table)
    return _build_table_out(table)
