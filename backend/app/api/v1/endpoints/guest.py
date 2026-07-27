"""
Public API Endpoints for Entrance QR Code Scanning, Guest Sessions, and Smart Table Assignment.
No authentication required (Unauthenticated guest endpoints).
"""

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.guest import (
    GuestFindTableInput,
    GuestSessionInitOut,
    GuestStatusOut,
    GuestTableReservationOut,
)
from app.services.guest import (
    cancel_guest_reservation,
    find_table_or_enqueue,
    get_guest_session_status,
    get_or_create_guest_session,
    mark_at_table,
)

router = APIRouter()


@router.post("/session", response_model=GuestSessionInitOut)
async def init_guest_session(
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Initialize or retrieve a guest session.
    Invoked when customer lands on /join page.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return session


@router.post("/find-table", response_model=GuestTableReservationOut)
async def find_table(
    payload: GuestFindTableInput,
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Find smallest available table fitting the group size.
    Reserves for 5 minutes or adds guest to waitlist queue if full.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await find_table_or_enqueue(db, session, payload)


@router.post("/at-table", response_model=GuestStatusOut)
async def customer_at_table(
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Customer presses "I'm at my table".
    Transitions table status to awaiting_verification and notifies waiters.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await mark_at_table(db, session)


@router.post("/cancel", response_model=GuestStatusOut)
async def cancel_reservation(
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel an active reservation or queue entry.
    Initiates a 5-minute cooldown period.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await cancel_guest_reservation(db, session)


@router.get("/status", response_model=GuestStatusOut)
async def check_status(
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch current live status, reservation countdown, or queue position.
    """
    session = await get_or_create_guest_session(db, session_token=x_session_token)
    return await get_guest_session_status(db, session)
