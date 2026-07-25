"""
Service layer for Guest Sessions, QR entrance smart table assignment,
and queue allocation logic with race-condition prevention and cooldown enforcement.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import GuestSession
from app.models.restaurant import Branch
from app.models.table import DiningTable, QueueEntry
from app.schemas.guest import (
    GuestFindTableInput,
    GuestStatusOut,
    GuestTableReservationOut,
)

logger = logging.getLogger("app.services.guest")

RESERVATION_DURATION_MINUTES = 5
COOLDOWN_DURATION_MINUTES = 5
SESSION_DURATION_HOURS = 2


async def _get_default_branch(db: AsyncSession) -> Branch:
    """Fetch default active branch."""
    result = await db.execute(
        select(Branch).where(Branch.is_active == True).limit(1)  # noqa: E712
    )
    branch = result.scalar_one_or_none()
    if not branch:
        # Fallback to any branch if no explicit active flag
        result = await db.execute(select(Branch).limit(1))
        branch = result.scalar_one_or_none()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active restaurant branch available.",
            )
    return branch


async def get_or_create_guest_session(
    db: AsyncSession, session_token: str | None = None
) -> GuestSession:
    """Retrieve an existing valid session or create a new token-backed GuestSession."""
    now = datetime.now(timezone.utc)

    if session_token:
        result = await db.execute(
            select(GuestSession).where(
                GuestSession.session_token == session_token,
                GuestSession.is_active == True,  # noqa: E712
                GuestSession.expires_at > now,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    branch = await _get_default_branch(db)
    token = f"gs_{secrets.token_urlsafe(32)}"
    expires_at = now + timedelta(hours=SESSION_DURATION_HOURS)

    new_session = GuestSession(
        session_token=token,
        branch_id=branch.id,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


async def release_expired_reservations(db: AsyncSession, branch_id: UUID) -> None:
    """Find and release any reservations that have passed their 5-minute expiry time."""
    now = datetime.now(timezone.utc)

    # 1. Find expired sessions
    expired_result = await db.execute(
        select(GuestSession).where(
            GuestSession.branch_id == branch_id,
            GuestSession.table_id.is_not(None),
            GuestSession.reservation_expires_at.is_not(None),
            GuestSession.reservation_expires_at <= now,
        )
    )
    expired_sessions = expired_result.scalars().all()

    for sess in expired_sessions:
        if sess.table_id:
            table_res = await db.execute(
                select(DiningTable).where(DiningTable.id == sess.table_id)
            )
            tbl = table_res.scalar_one_or_none()
            if tbl and tbl.status == "reserved":
                tbl.status = "available"
            sess.table_id = None
            sess.reservation_expires_at = None

    await db.commit()


async def find_table_or_enqueue(
    db: AsyncSession, session: GuestSession, payload: GuestFindTableInput
) -> GuestTableReservationOut:
    """
    Core Smart Table Assignment Logic:
    1. Check 5-minute cancellation cooldown.
    2. Check if active reservation already exists.
    3. Lock candidate tables (FOR UPDATE) & pick smallest fitting group.
    4. If none available, append to queue.
    """
    now = datetime.now(timezone.utc)

    # 1. Enforce cooldown if guest recently cancelled
    if session.cooldown_until and session.cooldown_until > now:
        remaining = int((session.cooldown_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Cooldown active after cancellation. "
                f"Please wait {remaining} seconds before requesting a table again."
            ),
        )

    # 2. Return existing unexpired reservation if present
    if session.table_id and session.reservation_expires_at and session.reservation_expires_at > now:
        tbl_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = tbl_res.scalar_one_or_none()
        rem_sec = int((session.reservation_expires_at - now).total_seconds())
        return GuestTableReservationOut(
            session_token=session.session_token,
            assigned=True,
            table_id=table.id if table else session.table_id,
            table_number=table.table_number if table else "N/A",
            capacity=table.capacity if table else payload.guest_count,
            reservation_expires_at=session.reservation_expires_at,
            remaining_seconds=rem_sec,
            message=f"Table {table.table_number if table else ''} is already reserved for your session.",
        )

    # 3. Clean up expired reservations first
    branch_id = session.branch_id or (await _get_default_branch(db)).id
    await release_expired_reservations(db, branch_id)

    # Update session details
    session.guest_name = payload.name
    session.guest_email = payload.email
    session.guest_count = payload.guest_count

    # 4. Search for candidate tables with row locking (SELECT ... FOR UPDATE)
    # Ignore tables in: cleaning, reserved, occupied, out_of_service
    stmt = (
        select(DiningTable)
        .where(
            DiningTable.branch_id == branch_id,
            DiningTable.is_active == True,  # noqa: E712
            DiningTable.deleted_at.is_(None),
            DiningTable.status == "available",
            DiningTable.capacity >= payload.guest_count,
        )
        .order_by(DiningTable.capacity.asc())
        .with_for_update()
    )

    candidate_res = await db.execute(stmt)
    candidate_tables = candidate_res.scalars().all()

    if candidate_tables:
        # Best match: smallest available table that fits the group
        best_table = candidate_tables[0]
        reservation_expiry = now + timedelta(minutes=RESERVATION_DURATION_MINUTES)

        best_table.status = "reserved"
        session.table_id = best_table.id
        session.reservation_expires_at = reservation_expiry

        # If user was in queue, update queue status to seated
        queue_res = await db.execute(
            select(QueueEntry).where(
                QueueEntry.guest_session_id == session.id,
                QueueEntry.status == "waiting",
            )
        )
        q_entry = queue_res.scalar_one_or_none()
        if q_entry:
            q_entry.status = "seated"

        await db.commit()
        await db.refresh(best_table)

        remaining_sec = int((reservation_expiry - now).total_seconds())
        return GuestTableReservationOut(
            session_token=session.session_token,
            assigned=True,
            table_id=best_table.id,
            table_number=best_table.table_number,
            capacity=best_table.capacity,
            reservation_expires_at=reservation_expiry,
            remaining_seconds=remaining_sec,
            message=f"Table {best_table.table_number} reserved successfully for {RESERVATION_DURATION_MINUTES} minutes!",
        )

    # 5. No suitable table available — append guest to Queue
    q_existing = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    existing_q = q_existing.scalar_one_or_none()

    if not existing_q:
        # Calculate queue position
        count_res = await db.execute(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == "waiting",
            )
        )
        waiting_count = count_res.scalar_one() or 0
        current_pos = waiting_count + 1
        est_wait = current_pos * 5

        new_q = QueueEntry(
            branch_id=branch_id,
            guest_session_id=session.id,
            customer_name=payload.name or "Walk-in Guest",
            customer_phone="",
            guest_count=payload.guest_count,
            status="waiting",
            current_position=current_pos,
            estimated_wait_minutes=est_wait,
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        q_item = new_q
    else:
        q_item = existing_q

    # Calculate actual waiting position
    pos_res = await db.execute(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.branch_id == branch_id,
            QueueEntry.status == "waiting",
            QueueEntry.joined_at <= q_item.joined_at,
        )
    )
    actual_pos = pos_res.scalar_one() or 1
    est_wait_min = actual_pos * 5

    await db.commit()

    return GuestTableReservationOut(
        session_token=session.session_token,
        assigned=False,
        in_queue=True,
        queue_id=q_item.id,
        queue_position=actual_pos,
        estimated_wait_minutes=est_wait_min,
        message="All matching tables are currently occupied. You have been added to the waiting queue.",
    )


async def cancel_guest_reservation(
    db: AsyncSession, session: GuestSession
) -> GuestStatusOut:
    """Cancel table reservation or queue entry & initiate 5-minute cooldown."""
    now = datetime.now(timezone.utc)
    cooldown_expiry = now + timedelta(minutes=COOLDOWN_DURATION_MINUTES)

    # 1. Release reserved table if held
    if session.table_id:
        table_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = table_res.scalar_one_or_none()
        if table and table.status == "reserved":
            table.status = "available"

        session.table_id = None
        session.reservation_expires_at = None

    # 2. Cancel waiting queue entry if any
    q_res = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    q_entry = q_res.scalar_one_or_none()
    if q_entry:
        q_entry.status = "cancelled"

    # Set 5-minute cooldown
    session.cooldown_until = cooldown_expiry
    await db.commit()

    return GuestStatusOut(
        session_token=session.session_token,
        guest_name=session.guest_name,
        guest_count=session.guest_count,
        has_active_reservation=False,
        in_queue=False,
        cooldown_active=True,
        cooldown_remaining_seconds=COOLDOWN_DURATION_MINUTES * 60,
        message="Reservation cancelled. 5-minute cooldown initiated.",
    )


async def get_guest_session_status(
    db: AsyncSession, session: GuestSession
) -> GuestStatusOut:
    """Fetch current live status for a guest session."""
    now = datetime.now(timezone.utc)

    # Check expired reservation
    if (
        session.table_id
        and session.reservation_expires_at
        and session.reservation_expires_at <= now
    ):
        await release_expired_reservations(
            db, session.branch_id or (await _get_default_branch(db)).id
        )
        await db.refresh(session)

    # Cooldown check
    cooldown_active = False
    cooldown_rem_sec = None
    if session.cooldown_until and session.cooldown_until > now:
        cooldown_active = True
        cooldown_rem_sec = int((session.cooldown_until - now).total_seconds())

    # Active table reservation
    if (
        session.table_id
        and session.reservation_expires_at
        and session.reservation_expires_at > now
    ):
        tbl_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = tbl_res.scalar_one_or_none()
        rem_sec = int((session.reservation_expires_at - now).total_seconds())
        return GuestStatusOut(
            session_token=session.session_token,
            guest_name=session.guest_name,
            guest_count=session.guest_count,
            has_active_reservation=True,
            table_id=table.id if table else session.table_id,
            table_number=table.table_number if table else "N/A",
            capacity=table.capacity if table else session.guest_count,
            reservation_expires_at=session.reservation_expires_at,
            remaining_seconds=rem_sec,
            in_queue=False,
            cooldown_active=cooldown_active,
            cooldown_remaining_seconds=cooldown_rem_sec,
            message=f"Table {table.table_number if table else ''} reserved.",
        )

    # Queue check
    q_res = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    q_entry = q_res.scalar_one_or_none()
    if q_entry:
        branch_id = session.branch_id or (await _get_default_branch(db)).id
        pos_res = await db.execute(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == "waiting",
                QueueEntry.joined_at <= q_entry.joined_at,
            )
        )
        actual_pos = pos_res.scalar_one() or 1
        est_wait = actual_pos * 5

        return GuestStatusOut(
            session_token=session.session_token,
            guest_name=session.guest_name,
            guest_count=session.guest_count,
            has_active_reservation=False,
            in_queue=True,
            queue_id=q_entry.id,
            queue_position=actual_pos,
            estimated_wait_minutes=est_wait,
            cooldown_active=cooldown_active,
            cooldown_remaining_seconds=cooldown_rem_sec,
            message=f"In queue at position {actual_pos}.",
        )

    return GuestStatusOut(
        session_token=session.session_token,
        guest_name=session.guest_name,
        guest_count=session.guest_count,
        has_active_reservation=False,
        in_queue=False,
        cooldown_active=cooldown_active,
        cooldown_remaining_seconds=cooldown_rem_sec,
        message="No active table reservation or queue entry.",
    )
