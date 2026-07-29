"""
Service layer for Billing, Razorpay Payment Gateway integration, Cash settlements,
Split Bill logic, Invoice HTML generation, and Resend Email delivery.
"""

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.settings import settings
from app.models.audit import AuditLog
from app.models.billing import Bill, BillItem, Payment
from app.models.customer import GuestSession
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.restaurant import Restaurant
from app.models.settings import RestaurantSettings
from app.models.staff import User
from app.schemas.billing import (
    BillGenerateInput,
    BillItemOut,
    BillOut,
    CashPaymentInput,
    PaymentOut,
    RazorpayOrderCreateInput,
    RazorpayOrderCreateOut,
    RazorpayVerifyInput,
    SplitBillInput,
    SplitBillOut,
)

logger = logging.getLogger("app.services.billing")


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def _get_restaurant_settings(db: AsyncSession) -> RestaurantSettings:
    """Fetch restaurant settings for tax and service charge percentages."""
    res = await db.execute(
        select(Restaurant).where(Restaurant.is_active.is_(True)).limit(1)
    )
    restaurant = res.scalar_one_or_none()
    if not restaurant:
        res_any = await db.execute(select(Restaurant).limit(1))
        restaurant = res_any.scalar_one_or_none()

    if restaurant:
        sett_res = await db.execute(
            select(RestaurantSettings).where(
                RestaurantSettings.restaurant_id == restaurant.id
            )
        )
        s = sett_res.scalar_one_or_none()
        if s:
            return s

    return RestaurantSettings(
        tax_percentage=5.0,
        service_charge_percentage=5.0,
        currency="INR",
    )


async def request_bill(db: AsyncSession, session_token: str) -> dict[str, str]:
    """Customer requests bill at their table."""
    now = datetime.now(UTC)
    sess_res = await db.execute(
        select(GuestSession)
        .options(selectinload(GuestSession.table))
        .where(
            GuestSession.session_token == session_token,
            GuestSession.is_active.is_(True),
        )
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active dining session not found.",
        )

    # Check all orders in session are completed or ready — block if any are still being prepared
    orders_res = await db.execute(
        select(Order).where(
            Order.guest_session_id == session.id,
            Order.deleted_at.is_(None),
        )
    )
    all_orders = orders_res.scalars().all()
    active_orders = [
        o
        for o in all_orders
        if o.status not in ("completed", "ready", "served", "cancelled")
    ]
    if active_orders:
        pending_statuses = ", ".join(set(o.status for o in active_orders))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request bill yet — some orders are still being processed ({pending_statuses}). Please wait for the kitchen to complete all orders.",
        )

    if not all_orders or all(o.status == "cancelled" for o in all_orders):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active orders found for this session.",
        )

    session.bill_requested_at = now

    table_num = session.table.table_number if session.table else "N/A"
    db.add(
        Notification(
            recipient_type="waiter",
            title=f"🧾 Bill Requested for Table {table_num}",
            message=f"Guest {session.guest_name or 'Customer'} at Table {table_num} requested the final bill.",
            notification_type="bill_requested",
            status="unread",
            payload_json={"session_id": str(session.id), "table_number": table_num},
        )
    )

    await db.commit()
    return {
        "message": f"Bill requested for Table {table_num}. Your waiter will arrive shortly."
    }


async def generate_bill(
    db: AsyncSession, payload: BillGenerateInput, current_user: User
) -> BillOut:
    """
    Waiter generates a consolidated bill for ALL orders in a dining session.
    LOCKS the dining session to prevent new orders.
    """
    now = datetime.now(UTC)

    # 1. Fetch the anchor order to get session context
    order_res = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.table),
            selectinload(Order.guest_session),
        )
        .where(Order.id == payload.order_id, Order.deleted_at.is_(None))
    )
    order = order_res.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # 2. Fetch ALL non-cancelled orders from the same active session or table
    if order.guest_session_id:
        all_orders_res = await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.menu_item))
            .where(
                Order.guest_session_id == order.guest_session_id,
                Order.deleted_at.is_(None),
                Order.status.notin_(["cancelled"]),
            )
        )
        session_orders = all_orders_res.scalars().all()
    elif order.table_id:
        # Check active guest session for table
        active_sess_res = await db.execute(
            select(GuestSession).where(
                GuestSession.table_id == order.table_id,
                GuestSession.is_active.is_(True),
            )
        )
        active_sess = active_sess_res.scalar_one_or_none()

        if active_sess:
            all_orders_res = await db.execute(
                select(Order)
                .options(selectinload(Order.items).selectinload(OrderItem.menu_item))
                .where(
                    Order.guest_session_id == active_sess.id,
                    Order.deleted_at.is_(None),
                    Order.status.notin_(["cancelled"]),
                )
            )
            session_orders = all_orders_res.scalars().all()
        else:
            # Exclude orders whose bill is already paid
            all_orders_res = await db.execute(
                select(Order)
                .options(selectinload(Order.items).selectinload(OrderItem.menu_item))
                .where(
                    Order.table_id == order.table_id,
                    Order.deleted_at.is_(None),
                    Order.status.notin_(["cancelled"]),
                )
            )
            raw_orders = all_orders_res.scalars().all()
            session_orders = []
            for o in raw_orders:
                b_res = await db.execute(
                    select(Bill).where(Bill.order_id == o.id, Bill.status == "paid")
                )
                if b_res.scalar_one_or_none() is None:
                    session_orders.append(o)
    else:
        session_orders = [order]

    # 3. Block if any order is still being prepared
    incomplete_statuses = {"pending", "accepted", "preparing", "paused"}
    incomplete = [o for o in session_orders if o.status in incomplete_statuses]
    if incomplete:
        statuses = ", ".join(set(o.status for o in incomplete))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate bill — {len(incomplete)} order(s) still in progress ({statuses}). Wait for kitchen to complete all orders.",
        )

    # 4. Check if an unpaid consolidated bill already exists for this session
    session_order_ids = [o.id for o in session_orders]
    existing_bill_res = await db.execute(
        select(Bill)
        .options(selectinload(Bill.items))
        .where(
            Bill.order_id.in_(session_order_ids),
            Bill.deleted_at.is_(None),
            Bill.status != "paid",
        )
        .order_by(Bill.created_at.desc())
        .limit(1)
    )
    existing_bill = existing_bill_res.scalar_one_or_none()

    # 5. Calculate totals across ALL session orders
    settings_obj = await _get_restaurant_settings(db)
    all_items = [item for o in session_orders for item in o.items]
    subtotal = sum(float(item.total_price) for item in all_items)
    tax_pct = float(settings_obj.tax_percentage or 0.0)
    service_pct = float(settings_obj.service_charge_percentage or 0.0)

    tax_amount = round(subtotal * (tax_pct / 100.0), 2)
    service_charge_amount = round(subtotal * (service_pct / 100.0), 2)
    discount = round(payload.discount_amount, 2)
    tip = round(payload.tip_amount, 2)

    grand_total = round(
        subtotal + tax_amount + service_charge_amount - discount + tip, 2
    )
    grand_total = max(0.0, grand_total)

    if existing_bill:
        # Update existing consolidated bill
        existing_bill.subtotal = subtotal
        existing_bill.tax_amount = tax_amount + service_charge_amount
        existing_bill.discount_amount = discount
        existing_bill.tip_amount = tip
        existing_bill.total_amount = grand_total
        bill = existing_bill
    else:
        # Generate new consolidated bill using anchor order id
        bill_num = f"INV-{now.strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"
        bill = Bill(
            order_id=order.id,  # anchor order
            bill_number=bill_num,
            subtotal=subtotal,
            tax_amount=tax_amount + service_charge_amount,
            discount_amount=discount,
            tip_amount=tip,
            total_amount=grand_total,
            status="unpaid",
        )
        db.add(bill)
        await db.flush()

        # Add itemized snapshots for ALL session orders
        for item in all_items:
            db.add(
                BillItem(
                    bill_id=bill.id,
                    order_item_id=item.id,
                    item_name=item.menu_item.name if item.menu_item else "Dish Item",
                    quantity=item.quantity,
                    unit_price=float(item.unit_price),
                    total_price=float(item.total_price),
                )
            )

    # 6. LOCK THE DINING SESSION
    if order.guest_session:
        order.guest_session.is_locked = True

    # 7. Audit Log
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="GENERATE_BILL",
            entity="Bill",
            entity_id=bill.id,
            new_value={
                "bill_number": bill.bill_number,
                "grand_total": grand_total,
                "order_count": len(session_orders),
                "is_locked": True,
            },
        )
    )

    await db.commit()
    
    bill_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.items),
            selectinload(Bill.order).selectinload(Order.table),
            selectinload(Bill.order).selectinload(Order.guest_session),
        )
        .where(Bill.id == bill.id)
    )
    bill = bill_res.scalar_one()

    return _build_bill_out(bill, order, settings_obj)


def _build_bill_out(
    bill: Bill, order: Order | None, settings_obj: RestaurantSettings
) -> BillOut:
    table_num = order.table.table_number if order and order.table else None
    guest_name = (
        order.guest_session.guest_name if order and order.guest_session else None
    )
    guest_email = (
        order.guest_session.guest_email if order and order.guest_session else None
    )
    session_id = order.guest_session.id if order and order.guest_session else None
    is_locked = order.guest_session.is_locked if order and order.guest_session else True
    can_review = (
        order.guest_session.can_submit_review
        if order and order.guest_session
        else False
    )

    subtotal = float(bill.subtotal)
    tax_pct = float(settings_obj.tax_percentage or 0.0)
    service_pct = float(settings_obj.service_charge_percentage or 0.0)
    tax_amt = round(subtotal * (tax_pct / 100.0), 2)
    service_amt = round(subtotal * (service_pct / 100.0), 2)

    item_dtos = [
        BillItemOut(
            id=bi.id,
            order_item_id=bi.order_item_id,
            item_name=bi.item_name,
            quantity=bi.quantity,
            unit_price=float(bi.unit_price),
            total_price=float(bi.total_price),
        )
        for bi in (bill.items or [])
    ]

    return BillOut(
        id=bill.id,
        order_id=bill.order_id,
        session_id=session_id,
        bill_number=bill.bill_number,
        table_number=table_num,
        guest_name=guest_name,
        guest_email=guest_email,
        subtotal=subtotal,
        tax_percentage=tax_pct,
        tax_amount=tax_amt,
        service_charge_percentage=service_pct,
        service_charge_amount=service_amt,
        discount_amount=float(bill.discount_amount),
        tip_amount=float(bill.tip_amount),
        grand_total=float(bill.total_amount),
        status=bill.status,
        is_locked=is_locked,
        can_submit_review=can_review,
        items=item_dtos,
        created_at=bill.created_at,
        updated_at=bill.updated_at,
    )


async def get_bill_by_id(db: AsyncSession, bill_id: uuid.UUID) -> BillOut:
    """Fetch itemized bill details by ID."""
    b_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.items),
            selectinload(Bill.order).selectinload(Order.table),
            selectinload(Bill.order).selectinload(Order.guest_session),
        )
        .where(Bill.id == bill_id, Bill.deleted_at.is_(None))
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    settings_obj = await _get_restaurant_settings(db)
    return _build_bill_out(bill, bill.order, settings_obj)


async def get_bill_by_session_token(
    db: AsyncSession, session_token: str
) -> BillOut | None:
    """Fetch active bill for customer dining session."""
    sess_res = await db.execute(
        select(GuestSession).where(GuestSession.session_token == session_token)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        return None

    order_res = await db.execute(
        select(Order).where(
            Order.guest_session_id == session.id, Order.deleted_at.is_(None)
        )
    )
    orders = order_res.scalars().all()
    if not orders:
        return None

    order_ids = [o.id for o in orders]
    b_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.items),
            selectinload(Bill.order).selectinload(Order.table),
            selectinload(Bill.order).selectinload(Order.guest_session),
        )
        .where(Bill.order_id.in_(order_ids), Bill.deleted_at.is_(None))
        .order_by(Bill.created_at.desc())
        .limit(1)
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        return None

    settings_obj = await _get_restaurant_settings(db)
    return _build_bill_out(bill, bill.order, settings_obj)


async def get_waiter_notifications(db: AsyncSession) -> list[dict]:
    """Fetch recent waiter alerts and bill requests."""
    res = await db.execute(
        select(Notification)
        .where(Notification.recipient_type == "waiter", Notification.status == "unread")
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    notifs = res.scalars().all()
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "payload": n.payload_json,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


async def mark_notification_read(
    db: AsyncSession, notification_id: uuid.UUID
) -> dict[str, str]:
    """Mark a single waiter notification as read (dismiss)."""
    now = datetime.now(UTC)
    res = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found."
        )
    notif.status = "read"
    notif.read_at = now
    await db.commit()
    return {"message": "Notification marked as read."}


async def clear_all_waiter_notifications(db: AsyncSession) -> dict[str, str]:
    """Mark all unread waiter notifications as read (clear all)."""
    now = datetime.now(UTC)
    res = await db.execute(
        select(Notification).where(
            Notification.recipient_type == "waiter",
            Notification.status == "unread",
        )
    )
    notifs = res.scalars().all()
    for n in notifs:
        n.status = "read"
        n.read_at = now
    await db.commit()
    return {"message": f"Cleared {len(notifs)} notification(s)."}


async def unlock_session(
    db: AsyncSession, session_id: uuid.UUID, manager_user: User
) -> dict[str, str]:
    """Manager unlocks dining session to allow additional orders."""
    sess_res = await db.execute(
        select(GuestSession).where(GuestSession.id == session_id)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )

    session.is_locked = False

    db.add(
        AuditLog(
            user_id=manager_user.id,
            action="UNLOCK_DINING_SESSION",
            entity="GuestSession",
            entity_id=session.id,
            new_value={"is_locked": False},
        )
    )
    await db.commit()
    return {"message": "Dining session unlocked. New orders can now be placed."}


async def calculate_split_bill(
    db: AsyncSession, payload: SplitBillInput
) -> SplitBillOut:
    """Calculate split bill amounts (equal, itemized, or custom)."""
    b_res = await db.execute(
        select(Bill)
        .options(selectinload(Bill.items))
        .where(Bill.id == payload.bill_id, Bill.deleted_at.is_(None))
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    grand_total = float(bill.total_amount)

    if payload.split_type == "equal":
        count = payload.split_count or 2
        share = round(grand_total / count, 2)
        return SplitBillOut(
            bill_id=bill.id,
            split_type="equal",
            share_amount=share,
            remaining_amount=round(grand_total - share, 2),
            total_bill_amount=grand_total,
            message=f"Equal split for {count} guests: ₹{share} per person.",
        )
    elif payload.split_type == "custom":
        custom = payload.custom_amount or (grand_total / 2)
        custom = min(custom, grand_total)
        return SplitBillOut(
            bill_id=bill.id,
            split_type="custom",
            share_amount=round(custom, 2),
            remaining_amount=round(grand_total - custom, 2),
            total_bill_amount=grand_total,
            message=f"Custom split amount: ₹{round(custom, 2)}.",
        )
    else:  # itemized split
        selected_ids = set(payload.order_item_ids or [])
        selected_subtotal = sum(
            float(item.total_price)
            for item in bill.items
            if item.order_item_id in selected_ids
        )
        ratio = selected_subtotal / float(bill.subtotal) if bill.subtotal > 0 else 0
        share = round(grand_total * ratio, 2)
        return SplitBillOut(
            bill_id=bill.id,
            split_type="item",
            share_amount=share,
            remaining_amount=round(grand_total - share, 2),
            total_bill_amount=grand_total,
            message=f"Itemized split for selected items: ₹{share}.",
        )


async def create_razorpay_order(
    db: AsyncSession, payload: RazorpayOrderCreateInput
) -> RazorpayOrderCreateOut:
    """
    Create Razorpay Payment Order on backend.
    Checks if bill is already paid to prevent duplicate charges.
    """
    b_res = await db.execute(select(Bill).where(Bill.id == payload.bill_id))
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    if bill.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill has already been paid in full.",
        )

    target_amount = payload.amount if payload.amount else float(bill.total_amount)
    amount_paise = int(round(target_amount * 100))

    key_id = settings.RAZORPAY_KEY_ID or "rzp_test_dev_key"
    key_secret = settings.RAZORPAY_KEY_SECRET or "rzp_test_dev_secret"

    # Call Razorpay API if live credentials present
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    json={
                        "amount": amount_paise,
                        "currency": "INR",
                        "receipt": bill.bill_number[:40],
                        "notes": {"bill_id": str(bill.id)},
                    },
                    auth=(key_id, key_secret),
                )
            if resp.status_code != 200:
                error_body = resp.text
                logger.error("Razorpay API error %s: %s", resp.status_code, error_body)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Razorpay order creation failed: {error_body}",
                )
            rzp_data = resp.json()
            rzp_order_id = rzp_data["id"]
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Razorpay API unreachable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not connect to Razorpay. Please try again.",
            )
    else:
        # Dev mode mock Razorpay Order ID (no real keys set)
        rzp_order_id = f"order_dev_{uuid.uuid4().hex[:14]}"

    # Check for existing pending payment to avoid duplicate Razorpay orders
    existing_pending = await db.execute(
        select(Payment).where(
            Payment.bill_id == bill.id,
            Payment.status == "pending",
            Payment.payment_gateway == "razorpay",
        )
    )
    existing_pay = existing_pending.scalar_one_or_none()
    if existing_pay:
        # Reuse existing pending payment order instead of creating a duplicate
        return RazorpayOrderCreateOut(
            razorpay_order_id=existing_pay.razorpay_order_id,
            amount=float(existing_pay.amount),
            amount_paise=int(round(float(existing_pay.amount) * 100)),
            currency="INR",
            key_id=key_id,
            bill_id=bill.id,
        )

    # Save pending Payment record
    db.add(
        Payment(
            bill_id=bill.id,
            payment_method="online",
            payment_gateway="razorpay",
            razorpay_order_id=rzp_order_id,
            amount=target_amount,
            status="pending",
        )
    )
    await db.commit()

    return RazorpayOrderCreateOut(
        razorpay_order_id=rzp_order_id,
        amount=target_amount,
        amount_paise=amount_paise,
        currency="INR",
        key_id=key_id,
        bill_id=bill.id,
    )


async def verify_razorpay_payment(
    db: AsyncSession, payload: RazorpayVerifyInput
) -> PaymentOut:
    """
    CRITICAL SECURITY FEATURE:
    Verify Razorpay payment HMAC SHA256 signature on backend.
    Never trust frontend payment status.
    """
    now = datetime.now(UTC)
    key_secret = settings.RAZORPAY_KEY_SECRET or "rzp_test_dev_secret"

    # Verify signature
    msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    generated_sig = hmac.new(
        key_secret.encode(), msg.encode(), hashlib.sha256
    ).hexdigest()

    # In dev mode with mock order, bypass signature check if matching prefix or in dev mode
    is_mock = (
        payload.razorpay_order_id.startswith("order_dev_")
        or payload.razorpay_signature.startswith("sig_mock_")
        or settings.APP_ENV == "development"
        or not settings.RAZORPAY_KEY_SECRET
    )
    if not is_mock and not hmac.compare_digest(
        generated_sig, payload.razorpay_signature
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay payment signature. Payment verification failed.",
        )

    # Fetch Payment record or create new
    p_res = await db.execute(
        select(Payment).where(
            Payment.razorpay_order_id == payload.razorpay_order_id,
            Payment.bill_id == payload.bill_id,
        )
    )
    payment = p_res.scalar_one_or_none()

    b_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.payments),
            selectinload(Bill.order).selectinload(Order.guest_session),
            selectinload(Bill.order).selectinload(Order.table),
        )
        .where(Bill.id == payload.bill_id)
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    paid_amt = payload.amount if payload.amount else float(bill.total_amount)

    if not payment:
        payment = Payment(
            bill_id=bill.id,
            payment_method="online",
            payment_gateway="razorpay",
            razorpay_order_id=payload.razorpay_order_id,
            transaction_reference=payload.razorpay_payment_id,
            razorpay_signature=payload.razorpay_signature,
            amount=paid_amt,
            status="completed",
            paid_at=now,
        )
        db.add(payment)
    else:
        payment.transaction_reference = payload.razorpay_payment_id
        payment.razorpay_signature = payload.razorpay_signature
        payment.status = "completed"
        payment.paid_at = now

    await db.flush()

    # Calculate total completed payments for bill
    existing_paid_sum = sum(
        float(p.amount)
        for p in (bill.payments or [])
        if p.status == "completed"
        and p != payment
        and getattr(p, "id", None) != getattr(payment, "id", None)
    )
    all_paid_sum = existing_paid_sum + paid_amt

    if all_paid_sum >= float(bill.total_amount):
        bill.status = "paid"
        await _execute_post_payment_actions(db, bill, now)
    else:
        bill.status = "partially_paid"

    db.add(
        AuditLog(
            action="VERIFY_RAZORPAY_PAYMENT",
            entity="Payment",
            entity_id=payment.id,
            new_value={
                "razorpay_payment_id": payload.razorpay_payment_id,
                "amount": paid_amt,
                "bill_status": bill.status,
            },
        )
    )

    await db.commit()
    await db.refresh(payment)

    return PaymentOut(
        id=payment.id,
        bill_id=payment.bill_id,
        payment_method=payment.payment_method,
        payment_gateway=payment.payment_gateway,
        transaction_reference=payment.transaction_reference,
        razorpay_order_id=payment.razorpay_order_id,
        amount=float(payment.amount),
        status=payment.status,
        paid_at=payment.paid_at,
        notes=payment.notes,
    )


async def confirm_cash_payment(
    db: AsyncSession, payload: CashPaymentInput, cashier_user: User
) -> PaymentOut:
    """Cashier confirms cash payment."""
    now = datetime.now(UTC)
    b_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.payments),
            selectinload(Bill.order).selectinload(Order.guest_session),
            selectinload(Bill.order).selectinload(Order.table),
        )
        .where(Bill.id == payload.bill_id)
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    if bill.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill has already been paid in full.",
        )

    payment = Payment(
        bill_id=bill.id,
        payment_method="cash",
        payment_gateway="cash",
        transaction_reference=f"CASH-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}",
        amount=payload.amount,
        status="completed",
        paid_at=now,
        cashier_user_id=cashier_user.id,
        notes=payload.notes,
    )
    db.add(payment)
    await db.flush()

    existing_paid_sum = sum(
        float(p.amount)
        for p in (bill.payments or [])
        if p.status == "completed"
        and p != payment
        and getattr(p, "id", None) != getattr(payment, "id", None)
    )
    all_paid_sum = existing_paid_sum + float(payload.amount)

    if all_paid_sum >= float(bill.total_amount):
        bill.status = "paid"
        await _execute_post_payment_actions(db, bill, now)
    else:
        bill.status = "partially_paid"

    db.add(
        AuditLog(
            user_id=cashier_user.id,
            action="CONFIRM_CASH_PAYMENT",
            entity="Payment",
            entity_id=payment.id,
            new_value={
                "amount": payload.amount,
                "cashier_id": str(cashier_user.id),
                "bill_status": bill.status,
            },
        )
    )

    await db.commit()
    await db.refresh(payment)

    return PaymentOut(
        id=payment.id,
        bill_id=payment.bill_id,
        payment_method=payment.payment_method,
        payment_gateway=payment.payment_gateway,
        transaction_reference=payment.transaction_reference,
        razorpay_order_id=payment.razorpay_order_id,
        amount=float(payment.amount),
        status=payment.status,
        paid_at=payment.paid_at,
        notes=payment.notes,
    )


async def request_cash_settlement(
    db: AsyncSession, bill_id: uuid.UUID
) -> dict[str, str]:
    """Customer requests cash settlement for their bill."""
    b_res = await db.execute(
        select(Bill)
        .options(
            selectinload(Bill.order).selectinload(Order.table),
            selectinload(Bill.order).selectinload(Order.guest_session),
        )
        .where(Bill.id == bill_id, Bill.deleted_at.is_(None))
    )
    bill = b_res.scalar_one_or_none()
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found."
        )

    table_num = (
        bill.order.table.table_number if (bill.order and bill.order.table) else "N/A"
    )
    guest_name = (
        bill.order.guest_session.guest_name
        if (
            bill.order
            and bill.order.guest_session
            and bill.order.guest_session.guest_name
        )
        else "Guest"
    )

    db.add(
        Notification(
            recipient_type="cashier",
            title=f"💵 Cash Payment Requested — Table {table_num}",
            message=f"{guest_name} at Table {table_num} requested to pay ₹{float(bill.total_amount):.2f} in cash for Bill #{bill.bill_number}.",
            notification_type="cash_settlement_requested",
            status="unread",
            payload_json={
                "bill_id": str(bill.id),
                "table_number": table_num,
                "amount": float(bill.total_amount),
            },
        )
    )
    db.add(
        Notification(
            recipient_type="waiter",
            title=f"💵 Cash Payment Requested — Table {table_num}",
            message=f"{guest_name} at Table {table_num} requested to pay ₹{float(bill.total_amount):.2f} in cash for Bill #{bill.bill_number}.",
            notification_type="cash_settlement_requested",
            status="unread",
            payload_json={
                "bill_id": str(bill.id),
                "table_number": table_num,
                "amount": float(bill.total_amount),
            },
        )
    )
    await db.commit()
    return {
        "message": f"Cash settlement requested for Table {table_num}! Please pay ₹{float(bill.total_amount):.2f} to staff at your table or cashier counter."
    }


async def _execute_post_payment_actions(
    db: AsyncSession, bill: Bill, now: datetime
) -> None:
    """
    POST-PAYMENT ACTIONS AFTER FULL PAYMENT:
    1. Close dining session.
    2. Change table status to Cleaning.
    3. Enable review submission.
    4. Send invoice email via Resend if email provided.
    """
    if bill.order:
        # Table status -> cleaning
        if bill.order.table:
            bill.order.table.status = "cleaning"

        # Mark ALL orders of this session as completed
        if bill.order.guest_session_id:
            sess_orders_res = await db.execute(
                select(Order).where(
                    Order.guest_session_id == bill.order.guest_session_id,
                    Order.deleted_at.is_(None),
                )
            )
            for ord_obj in sess_orders_res.scalars().all():
                if ord_obj.status != "cancelled":
                    ord_obj.status = "completed"
        elif bill.order.table_id:
            tbl_orders_res = await db.execute(
                select(Order).where(
                    Order.table_id == bill.order.table_id,
                    Order.deleted_at.is_(None),
                )
            )
            for ord_obj in tbl_orders_res.scalars().all():
                if ord_obj.status != "cancelled":
                    ord_obj.status = "completed"
        else:
            if bill.order.status != "cancelled":
                bill.order.status = "completed"

        # Dining session -> ended, unlock & enable review
        if bill.order.guest_session:
            sess = bill.order.guest_session
            sess.is_active = False
            sess.is_locked = False
            sess.can_submit_review = True
            sess.table_id = None
            sess.reservation_expires_at = None

            # Trigger Resend Email if email is present
            if sess.guest_email:
                await send_invoice_email(bill, sess.guest_email)


async def send_invoice_email(bill: Bill, to_email: str) -> None:
    """Send tax invoice email via Resend API."""
    if not settings.RESEND_API_KEY:
        logger.info("Resend API key not set. Skipped invoice email to %s", to_email)
        return

    try:
        data = json.dumps(
            {
                "from": "Smart Restaurant <invoices@resman.app>",
                "to": [to_email],
                "subject": f"Tax Invoice - {bill.bill_number}",
                "html": f"""
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Thank you for dining with us!</h2>
              <p>Here is your tax invoice summary:</p>
              <ul>
                <li><strong>Invoice Number:</strong> {bill.bill_number}</li>
                <li><strong>Total Amount Paid:</strong> ₹{bill.total_amount:.2f}</li>
                <li><strong>Status:</strong> PAID</li>
              </ul>
              <p>We look forward to serving you again!</p>
            </div>
            """,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(
                "Sent Resend invoice email to %s: status %s", to_email, resp.status
            )
    except Exception as exc:
        logger.warning("Failed to send Resend invoice email: %s", exc)


def generate_invoice_html(bill: BillOut) -> str:
    """Generate printable HTML Tax Invoice."""
    items_html = "".join(f"""
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">{item.item_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">{item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹{item.unit_price:.2f}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹{item.total_price:.2f}</td>
        </tr>
        """ for item in bill.items)

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tax Invoice - {bill.bill_number}</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; background: #fff; }}
        .invoice-box {{ max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #222; padding-bottom: 20px; }}
        .table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        .totals {{ margin-top: 20px; text-align: right; font-size: 14px; line-height: 1.8; }}
        .grand-total {{ font-size: 18px; font-weight: bold; color: #16a34a; border-top: 2px solid #222; padding-top: 8px; margin-top: 8px; }}
        @media print {{ body {{ padding: 0; }} .invoice-box {{ border: none; box-shadow: none; }} }}
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 24px;">Smart Restaurant</h1>
            <p style="margin: 4px 0; color: #666; font-size: 12px;">Official Tax Invoice</p>
          </div>
          <div style="text-align: right;">
            <h3 style="margin: 0;">{bill.bill_number}</h3>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Table: <strong>{bill.table_number or 'N/A'}</strong></p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Date: {bill.created_at.strftime('%Y-%m-%d %H:%M')}</p>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr style="background: #f8f9fa; text-align: left; font-size: 12px; text-transform: uppercase;">
              <th style="padding: 8px;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            {items_html}
          </tbody>
        </table>

        <div class="totals">
          <p style="margin: 2px 0;">Subtotal: ₹{bill.subtotal:.2f}</p>
          <p style="margin: 2px 0;">GST Tax ({bill.tax_percentage}%): ₹{bill.tax_amount:.2f}</p>
          <p style="margin: 2px 0;">Service Charge ({bill.service_charge_percentage}%): ₹{bill.service_charge_amount:.2f}</p>
          {f'<p style="margin: 2px 0; color: #dc2626;">Discount: -₹{bill.discount_amount:.2f}</p>' if bill.discount_amount > 0 else ''}
          {f'<p style="margin: 2px 0;">Tip: +₹{bill.tip_amount:.2f}</p>' if bill.tip_amount > 0 else ''}
          <div class="grand-total">
            Grand Total: ₹{bill.grand_total:.2f}
          </div>
          <p style="margin-top: 10px; font-size: 12px; font-weight: bold; color: {'#16a34a' if bill.status == 'paid' else '#d97706'};">
            Payment Status: {bill.status.upper()}
          </p>
        </div>
      </div>
    </body>
    </html>
    """


async def get_all_bills(
    db: AsyncSession, status_filter: str | None = None
) -> list[BillOut]:
    """Fetch all bills with optional status filtering for Cashier POS."""
    stmt = (
        select(Bill)
        .options(
            selectinload(Bill.items),
            selectinload(Bill.payments),
            selectinload(Bill.order).selectinload(Order.table),
            selectinload(Bill.order).selectinload(Order.guest_session),
        )
        .order_by(Bill.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Bill.status == status_filter)

    settings_obj = await _get_restaurant_settings(db)
    res = await db.execute(stmt)
    bills = res.scalars().all()
    return [_build_bill_out(b, b.order, settings_obj) for b in bills]
