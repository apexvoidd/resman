"""
Pydantic schemas for Billing & Payment API workflows.
Includes Razorpay payment creation/verification, Cash payments, Split bills, and Invoices.
"""

import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class BillItemOut(BaseModel):
    id: uuid.UUID
    order_item_id: uuid.UUID
    item_name: str
    quantity: int
    unit_price: float
    total_price: float

    model_config = {"from_attributes": True}


class BillOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    session_id: uuid.UUID | None = None
    bill_number: str
    table_number: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    subtotal: float
    tax_percentage: float = 0.0
    tax_amount: float = 0.0
    service_charge_percentage: float = 0.0
    service_charge_amount: float = 0.0
    discount_amount: float = 0.0
    tip_amount: float = 0.0
    grand_total: float
    status: Literal["unpaid", "partially_paid", "paid", "refunded"]
    is_locked: bool = True
    can_submit_review: bool = False
    items: list[BillItemOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillGenerateInput(BaseModel):
    order_id: uuid.UUID
    discount_amount: float = Field(0.0, ge=0)
    tip_amount: float = Field(0.0, ge=0)
    discount_name: str | None = None


class RazorpayOrderCreateInput(BaseModel):
    bill_id: uuid.UUID
    amount: float | None = Field(None, gt=0, description="Optional custom/split amount")


class RazorpayOrderCreateOut(BaseModel):
    razorpay_order_id: str
    amount: float
    amount_paise: int
    currency: str = "INR"
    key_id: str
    bill_id: uuid.UUID


class RazorpayVerifyInput(BaseModel):
    bill_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: float | None = None


class CashPaymentInput(BaseModel):
    bill_id: uuid.UUID
    amount: float = Field(..., gt=0)
    notes: str | None = None


class SplitBillInput(BaseModel):
    bill_id: uuid.UUID
    split_type: Literal["equal", "item", "custom"]
    split_count: int | None = Field(None, ge=2, le=20)
    order_item_ids: list[uuid.UUID] | None = None
    custom_amount: float | None = Field(None, gt=0)


class SplitBillOut(BaseModel):
    bill_id: uuid.UUID
    split_type: str
    share_amount: float
    remaining_amount: float
    total_bill_amount: float
    message: str


class PaymentOut(BaseModel):
    id: uuid.UUID
    bill_id: uuid.UUID
    payment_method: str
    payment_gateway: str | None = None
    transaction_reference: str | None = None
    razorpay_order_id: str | None = None
    amount: float
    status: Literal["pending", "completed", "failed", "partially_paid", "refunded"]
    paid_at: datetime | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}
