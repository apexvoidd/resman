"""
Service layer for Guest Sessions, QR entrance smart table assignment,
queue allocation, customer arrival verification, and cooldown enforcement.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.audit import AuditLog
from app.models.customer import GuestSession
from app.models.notification import Notification
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


from app.models.restaurant import Restaurant

async def _get_default_branch(db: AsyncSession) -> Branch:
    """Fetch or auto-create default active branch."""
    result = await db.execute(
        select(Branch).where(Branch.is_active == True).limit(1)  # noqa: E712
    )
    branch = result.scalar_one_or_none()
    if not branch:
        result = await db.execute(select(Branch).limit(1))
        branch = result.scalar_one_or_none()

    if not branch:
        # Create default restaurant & main branch
        rest_res = await db.execute(select(Restaurant).limit(1))
        restaurant = rest_res.scalar_one_or_none()
        if not restaurant:
            restaurant = Restaurant(
                name="Smart Restaurant",
                is_active=True,
            )
            db.add(restaurant)
            await db.commit()
            await db.refresh(restaurant)

        branch = Branch(
            restaurant_id=restaurant.id,
            name="Main Branch",
            address="127 Innovation Way",
            phone="+1 (555) 019-2831",
            is_active=True,
        )
        db.add(branch)
        await db.commit()
        await db.refresh(branch)

        # Seed default dining tables
        for i in range(1, 11):
            capacity = 2 if i <= 4 else (4 if i <= 8 else 8)
            tbl = DiningTable(
                branch_id=branch.id,
                table_number=f"T-{i}",
                capacity=capacity,
                status="available",
                is_active=True,
            )
            db.add(tbl)
        await db.commit()

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
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            # Normalize expires_at to UTC-aware for comparison (SQLite returns naive datetimes)
            exp = existing.expires_at
            if exp is not None and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            # Session is active — return as-is or extend if expired with table
            if existing.is_active:
                if exp is not None and exp <= now and existing.table_id is not None:
                    existing.expires_at = now + timedelta(hours=SESSION_DURATION_HOURS)
                    await db.commit()
                    await db.refresh(existing)
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
            if tbl and tbl.status in ("reserved", "awaiting_verification"):
                tbl.status = "available"
            sess.table_id = None
            sess.reservation_expires_at = None
            sess.verification_status = "none"

    await db.commit()


async def _find_best_table(
    db: AsyncSession, branch_id: UUID, guest_count: int
) -> "DiningTable | None":
    """
    Smart table selection logic:
    1. Try exact or smallest-sufficient table first (capacity >= guest_count).
    2. If none available AND guest_count > max available table capacity,
       assign the LARGEST available table (better than leaving them stuck in queue).
    3. If no available tables at all, return None.
    """
    # First: try to find a table that fits
    stmt = (
        select(DiningTable)
        .where(
            DiningTable.branch_id == branch_id,
            DiningTable.is_active == True,  # noqa: E712
            DiningTable.deleted_at.is_(None),
            DiningTable.status == "available",
            DiningTable.capacity >= guest_count,
        )
        .order_by(DiningTable.capacity.asc())  # smallest fitting table first
    )
    result = await db.execute(stmt)
    table = result.scalars().first()
    if table:
        return table

    # Second: no table fits — find the largest available table as fallback
    # (e.g. 6-person group but only 4-person tables available)
    stmt_largest = (
        select(DiningTable)
        .where(
            DiningTable.branch_id == branch_id,
            DiningTable.is_active == True,  # noqa: E712
            DiningTable.deleted_at.is_(None),
            DiningTable.status == "available",
        )
        .order_by(DiningTable.capacity.desc())  # largest available table
    )
    result_largest = await db.execute(stmt_largest)
    largest = result_largest.scalars().first()
    return largest  # None if no tables at all


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

    cd_until = _ensure_utc(session.cooldown_until)
    if cd_until and cd_until > now:
        remaining = int((cd_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Cooldown active after cancellation. "
                f"Please wait {remaining} seconds before requesting a table again."
            ),
        )

    res_exp = _ensure_utc(session.reservation_expires_at)
    if session.table_id and res_exp and res_exp > now:
        tbl_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = tbl_res.scalar_one_or_none()
        rem_sec = int((res_exp - now).total_seconds())
        return GuestTableReservationOut(
            session_token=session.session_token,
            assigned=True,
            table_id=table.id if table else session.table_id,
            table_number=table.table_number if table else "N/A",
            capacity=table.capacity if table else payload.guest_count,
            reservation_expires_at=session.reservation_expires_at,
            remaining_seconds=rem_sec,
            verification_status=session.verification_status,
            rejection_reason=session.rejection_reason,
            menu_unlocked=session.verification_status == "confirmed" or (table and table.status == "occupied"),
            message=f"Table {table.table_number if table else ''} is reserved for your session.",
        )

    branch_id = session.branch_id or (await _get_default_branch(db)).id
    await release_expired_reservations(db, branch_id)

    session.guest_name = payload.name
    session.guest_email = payload.email
    session.guest_count = payload.guest_count

    best_table = await _find_best_table(db, branch_id, payload.guest_count)

    if best_table:
        reservation_expiry = now + timedelta(minutes=RESERVATION_DURATION_MINUTES)

        best_table.status = "reserved"
        session.table_id = best_table.id
        session.reservation_expires_at = reservation_expiry
        session.verification_status = "none"

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
            verification_status=session.verification_status,
            rejection_reason=session.rejection_reason,
            menu_unlocked=False,
            message=(
                f"Table {best_table.table_number} reserved for {RESERVATION_DURATION_MINUTES} minutes!"
                + (f" Note: table seats {best_table.capacity} — please arrange extra seating with staff." if best_table.capacity < payload.guest_count else "")
            ),
        )

    q_existing = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    existing_q = q_existing.scalar_one_or_none()

    if not existing_q:
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


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def mark_at_table(
    db: AsyncSession, session: GuestSession
) -> GuestStatusOut:
    """
    Customer presses 'I'm at my table':
    1. Validates or assigns an active table for the guest session.
    2. Transitions table status to 'awaiting_verification'.
    3. Notifies waiters in real time & writes AuditLog.
    """
    now = datetime.now(timezone.utc)

    if not session.table_id:
        branch = await _get_default_branch(db)
        avail_res = await db.execute(
            select(DiningTable).where(
                DiningTable.branch_id == branch.id,
                DiningTable.is_active == True,  # noqa: E712
                DiningTable.deleted_at.is_(None),
                DiningTable.status == "available",
            ).order_by(DiningTable.table_number.asc()).limit(1)
        )
        avail_tbl = avail_res.scalar_one_or_none()
        if avail_tbl:
            session.table_id = avail_tbl.id
            session.reservation_expires_at = now + timedelta(minutes=5)
            avail_tbl.status = "reserved"
            await db.commit()
            await db.refresh(session)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No table reservation associated with this guest session. Please check in on /join page.",
            )

    stmt = select(DiningTable).where(DiningTable.id == session.table_id)
    if not settings.DATABASE_URL.startswith("sqlite"):
        stmt = stmt.with_for_update()

    tbl_res = await db.execute(stmt)
    table = tbl_res.scalar_one_or_none()

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned dining table not found.",
        )

    res_exp = _ensure_utc(session.reservation_expires_at)
    if table.status == "occupied":
        rem_sec = int((res_exp - now).total_seconds()) if res_exp and res_exp > now else None
        return GuestStatusOut(
            session_token=session.session_token,
            guest_name=session.guest_name,
            guest_count=session.guest_count,
            has_active_reservation=True,
            table_id=table.id,
            table_number=table.table_number,
            capacity=table.capacity,
            table_status="occupied",
            reservation_expires_at=session.reservation_expires_at,
            remaining_seconds=rem_sec,
            verification_status="confirmed",
            menu_unlocked=True,
            in_queue=False,
            message="Arrival already confirmed by staff.",
        )

    if table.status not in ("reserved", "awaiting_verification"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table.table_number} is in state '{table.status}' and cannot be requested for verification.",
        )

    old_status = table.status
    table.status = "awaiting_verification"
    session.verification_status = "awaiting_verification"
    session.verification_requested_at = now
    session.rejection_reason = None

    # Audit log entry
    audit = AuditLog(
        action="TABLE_AWAITING_VERIFICATION",
        entity="DiningTable",
        entity_id=table.id,
        old_value={"status": old_status},
        new_value={"status": "awaiting_verification", "session_token": session.session_token},
    )
    db.add(audit)

    # Realtime notification record for waiters
    notif = Notification(
        recipient_type="waiter",
        title=f"Arrival Verification: Table {table.table_number}",
        message=f"Guest '{session.guest_name or 'Walk-in'}' ({session.guest_count or 1} guests) has arrived at Table {table.table_number} and requests verification.",
        notification_type="arrival_verification",
        status="unread",
        payload_json={
            "table_id": str(table.id),
            "table_number": table.table_number,
            "guest_session_id": str(session.id),
            "guest_name": session.guest_name,
            "guest_count": session.guest_count,
        },
    )
    db.add(notif)

    await db.commit()
    await db.refresh(table)

    rem_sec = int((res_exp - now).total_seconds()) if res_exp and res_exp > now else None
    return GuestStatusOut(
        session_token=session.session_token,
        guest_name=session.guest_name,
        guest_count=session.guest_count,
        has_active_reservation=True,
        table_id=table.id,
        table_number=table.table_number,
        capacity=table.capacity,
        table_status="awaiting_verification",
        reservation_expires_at=session.reservation_expires_at,
        remaining_seconds=rem_sec,
        verification_status="awaiting_verification",
        menu_unlocked=False,
        in_queue=False,
        message=f"Verification request sent to waiter for Table {table.table_number}.",
    )


async def cancel_guest_reservation(
    db: AsyncSession, session: GuestSession
) -> GuestStatusOut:
    """Cancel table reservation or queue entry & initiate 5-minute cooldown."""
    now = datetime.now(timezone.utc)
    cooldown_expiry = now + timedelta(minutes=COOLDOWN_DURATION_MINUTES)

    if session.table_id:
        table_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = table_res.scalar_one_or_none()
        if table and table.status in ("reserved", "awaiting_verification"):
            table.status = "available"

        session.table_id = None
        session.reservation_expires_at = None
        session.verification_status = "none"

    q_res = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    q_entry = q_res.scalar_one_or_none()
    if q_entry:
        q_entry.status = "cancelled"

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

    res_exp = _ensure_utc(session.reservation_expires_at)
    if (
        session.table_id
        and res_exp
        and res_exp <= now
        and session.verification_status != "confirmed"
    ):
        await release_expired_reservations(
            db, session.branch_id or (await _get_default_branch(db)).id
        )
        await db.refresh(session)

    cooldown_active = False
    cooldown_rem_sec = None
    cd_until = _ensure_utc(session.cooldown_until)
    if cd_until and cd_until > now:
        cooldown_active = True
        cooldown_rem_sec = int((cd_until - now).total_seconds())

    if session.table_id:
        tbl_res = await db.execute(
            select(DiningTable).where(DiningTable.id == session.table_id)
        )
        table = tbl_res.scalar_one_or_none()
        if table:
            rem_sec = int((res_exp - now).total_seconds()) if res_exp and res_exp > now else None
            menu_unlocked = (session.verification_status == "confirmed") or (table.status == "occupied")
            return GuestStatusOut(
                session_token=session.session_token,
                guest_name=session.guest_name,
                guest_count=session.guest_count,
                has_active_reservation=True,
                table_id=table.id,
                table_number=table.table_number,
                capacity=table.capacity,
                table_status=table.status,
                reservation_expires_at=session.reservation_expires_at,
                remaining_seconds=rem_sec,
                verification_status=session.verification_status,
                rejection_reason=session.rejection_reason,
                menu_unlocked=menu_unlocked,
                in_queue=False,
                cooldown_active=cooldown_active,
                cooldown_remaining_seconds=cooldown_rem_sec,
                message=f"Table {table.table_number} ({table.status}).",
            )

    q_res = await db.execute(
        select(QueueEntry).where(
            QueueEntry.guest_session_id == session.id,
            QueueEntry.status == "waiting",
        )
    )
    q_entry = q_res.scalar_one_or_none()
    if q_entry:
        branch_id = session.branch_id or (await _get_default_branch(db)).id

        # AUTO-ASSIGN: check if a table is now available for this queued customer
        guest_count = session.guest_count or q_entry.guest_count or 1
        available_table = await _find_best_table(db, branch_id, guest_count)

        if available_table:
            # Table is available — assign it and remove from queue
            reservation_expiry = now + timedelta(minutes=RESERVATION_DURATION_MINUTES)
            available_table.status = "reserved"
            session.table_id = available_table.id
            session.reservation_expires_at = reservation_expiry
            session.verification_status = "none"
            q_entry.status = "seated"

            # Notify customer (waiter notification)
            db.add(
                Notification(
                    recipient_type="waiter",
                    title=f"Queue Customer Seated: Table {available_table.table_number}",
                    message=f"Guest '{session.guest_name or 'Walk-in'}' from the waiting queue has been assigned Table {available_table.table_number}.",
                    notification_type="queue_seated",
                    status="unread",
                    payload_json={
                        "table_id": str(available_table.id),
                        "table_number": available_table.table_number,
                        "guest_session_id": str(session.id),
                    },
                )
            )
            await db.commit()
            await db.refresh(session)

            remaining_sec = int((reservation_expiry - now).total_seconds())
            return GuestStatusOut(
                session_token=session.session_token,
                guest_name=session.guest_name,
                guest_count=session.guest_count,
                has_active_reservation=True,
                table_id=available_table.id,
                table_number=available_table.table_number,
                capacity=available_table.capacity,
                table_status="reserved",
                reservation_expires_at=reservation_expiry,
                remaining_seconds=remaining_sec,
                verification_status="none",
                menu_unlocked=False,
                in_queue=False,
                cooldown_active=cooldown_active,
                cooldown_remaining_seconds=cooldown_rem_sec,
                message=(
                    f"🎉 Table {available_table.table_number} reserved for you!"
                    + (f" Note: table seats {available_table.capacity} — please arrange extra seating with staff." if available_table.capacity < guest_count else "")
                ),
            )

        # No table yet — return queue position
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
