"""
API Endpoints for Billing & Payments:
- Customer Bill Request
- Waiter Bill Generation & Session Locking
- Manager Session Unlock
- Razorpay Payment Order Creation & Backend HMAC Verification
- Cash Settlement Confirmation
- Split Bill Calculations
- Printable HTML Tax Invoices
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.billing import (
    BillGenerateInput,
    BillOut,
    CashPaymentInput,
    PaymentOut,
    RazorpayOrderCreateInput,
    RazorpayOrderCreateOut,
    RazorpayVerifyInput,
    SplitBillInput,
    SplitBillOut,
)
from app.services import billing as billing_service

router = APIRouter()


@router.post(
    "/request-bill",
    summary="Customer requests bill at dining table",
    status_code=status.HTTP_200_OK,
)
async def request_bill(
    session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Customer taps Request Bill. Sends notification to assigned waiters."""
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session token required in X-Session-Token header.",
        )
    return await billing_service.request_bill(db, session_token)


@router.post(
    "/generate",
    response_model=BillOut,
    summary="Waiter generates final itemized bill and locks dining session",
    status_code=status.HTTP_200_OK,
)
async def generate_bill(
    payload: BillGenerateInput,
    current_user: User = Depends(require_role(["waiter", "cashier", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Waiter generates itemized bill and locks the session from new orders."""
    return await billing_service.generate_bill(db, payload, current_user)


@router.get(
    "/bills",
    response_model=list[BillOut],
    summary="List all bills for Cashier POS Terminal",
    status_code=status.HTTP_200_OK,
)
async def list_all_bills(
    status_filter: str | None = None,
    current_user: User = Depends(require_role(["cashier", "waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Cashier/Manager lists all bills with optional status filter."""
    return await billing_service.get_all_bills(db, status_filter)


@router.get(
    "/bills/{bill_id}",
    response_model=BillOut,
    summary="Fetch itemized bill details by ID",
    status_code=status.HTTP_200_OK,
)
async def get_bill(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get bill itemized breakdown, taxes, and payment status."""
    return await billing_service.get_bill_by_id(db, bill_id)


@router.get(
    "/session-bill",
    response_model=BillOut | None,
    summary="Fetch active bill for customer dining session",
    status_code=status.HTTP_200_OK,
)
async def get_session_bill(
    session_token: str | None = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Customer gets active bill for their dining session."""
    if not session_token:
        return None
    return await billing_service.get_bill_by_session_token(db, session_token)


@router.get(
    "/notifications/waiter",
    summary="Waiter fetches active bill requests and alerts",
    status_code=status.HTTP_200_OK,
)
async def get_waiter_notifications(
    current_user: User = Depends(require_role(["waiter", "cashier", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Waiter fetches unread real-time notifications and bill requests."""
    return await billing_service.get_waiter_notifications(db)


@router.post(
    "/notifications/waiter/clear-all",
    summary="Clear all unread waiter notifications",
    status_code=status.HTTP_200_OK,
)
async def clear_waiter_notifications(
    current_user: User = Depends(require_role(["waiter", "cashier", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Mark all unread waiter notifications as read."""
    return await billing_service.clear_all_waiter_notifications(db)


@router.post(
    "/notifications/{notification_id}/read",
    summary="Dismiss a single waiter notification",
    status_code=status.HTTP_200_OK,
)
async def dismiss_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_role(["waiter", "cashier", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Mark a single notification as read (dismiss it)."""
    return await billing_service.mark_notification_read(db, notification_id)


@router.post(
    "/sessions/{session_id}/unlock",
    summary="Manager unlocks dining session for new orders",
    status_code=status.HTTP_200_OK,
)
async def unlock_session(
    session_id: uuid.UUID,
    manager_user: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Only Manager or Admin can unlock a locked dining session."""
    return await billing_service.unlock_session(db, session_id, manager_user)


@router.post(
    "/split-calculate",
    response_model=SplitBillOut,
    summary="Calculate split bill breakdown (equal, itemized, or custom)",
    status_code=status.HTTP_200_OK,
)
async def calculate_split_bill(
    payload: SplitBillInput,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Calculate split share amounts."""
    return await billing_service.calculate_split_bill(db, payload)


@router.post(
    "/razorpay/create-order",
    response_model=RazorpayOrderCreateOut,
    summary="Create Razorpay payment order ID",
    status_code=status.HTTP_200_OK,
)
async def create_razorpay_order(
    payload: RazorpayOrderCreateInput,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Creates a Razorpay payment order for UPI, Card, or Net Banking."""
    return await billing_service.create_razorpay_order(db, payload)


@router.post(
    "/razorpay/verify",
    response_model=PaymentOut,
    summary="Verify Razorpay payment HMAC signature on backend",
    status_code=status.HTTP_200_OK,
)
async def verify_razorpay_payment(
    payload: RazorpayVerifyInput,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    CRITICAL SECURITY CHECK:
    Verifies Razorpay HMAC SHA256 signature backend-side to prevent tampering.
    """
    return await billing_service.verify_razorpay_payment(db, payload)


@router.post(
    "/cash/confirm",
    response_model=PaymentOut,
    summary="Cashier confirms cash payment",
    status_code=status.HTTP_200_OK,
)
async def confirm_cash_payment(
    payload: CashPaymentInput,
    current_user: User = Depends(require_role(["cashier", "waiter", "manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Cashier records completed cash payment and settlement."""
    return await billing_service.confirm_cash_payment(db, payload, current_user)


@router.get(
    "/invoices/{bill_id}/html",
    response_class=HTMLResponse,
    summary="Generate printable HTML tax invoice",
    status_code=status.HTTP_200_OK,
)
async def get_invoice_html(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Generates printable tax invoice HTML for download/print."""
    bill = await billing_service.get_bill_by_id(db, bill_id)
    return HTMLResponse(content=billing_service.generate_invoice_html(bill))
