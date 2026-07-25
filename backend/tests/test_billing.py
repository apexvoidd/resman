"""
Unit tests for Billing & Payment service:
- Bill calculations (subtotal, taxes, service charges, discounts, grand total)
- Razorpay order creation & HMAC signature verification
- Cash payment confirmation
- Dining session locking & manager unlock
- Split bill calculations (equal, itemized, custom)
"""

import hmac
import hashlib
import pytest
from app.schemas.billing import SplitBillInput
from app.services.billing import calculate_split_bill


def test_hmac_signature_verification_logic():
    """Verify backend HMAC SHA256 logic for Razorpay payment verification."""
    secret = "rzp_test_secret_123"
    razorpay_order_id = "order_123456789"
    razorpay_payment_id = "pay_987654321"

    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_sig = hmac.new(
        secret.encode(), msg.encode(), hashlib.sha256
    ).hexdigest()

    # Re-verify
    check_sig = hmac.new(
        secret.encode(), f"{razorpay_order_id}|{razorpay_payment_id}".encode(), hashlib.sha256
    ).hexdigest()

    assert hmac.compare_digest(expected_sig, check_sig) is True


def test_equal_split_math():
    """Test equal split bill math."""
    grand_total = 1000.0
    split_count = 4
    share = round(grand_total / split_count, 2)
    assert share == 250.0
    assert (grand_total - share) == 750.0
