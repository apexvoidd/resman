/**
 * Frontend Billing & Payments Service.
 * Interfaces with FastAPI endpoints for Bill Request, Generation, Razorpay Payments,
 * Cash settlements, Split Bill calculation, and Printable Tax Invoices.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface BillItem {
  id: string;
  order_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface BillData {
  id: string;
  order_id: string;
  session_id: string | null;
  bill_number: string;
  table_number: string | null;
  guest_name: string | null;
  guest_email: string | null;
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  service_charge_percentage: number;
  service_charge_amount: number;
  discount_amount: number;
  tip_amount: number;
  grand_total: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded";
  is_locked: boolean;
  can_submit_review: boolean;
  items: BillItem[];
  created_at: string;
  updated_at: string;
}

export interface SplitBillParams {
  bill_id: string;
  split_type: "equal" | "item" | "custom";
  split_count?: number;
  order_item_ids?: string[];
  custom_amount?: number;
}

export interface SplitBillResult {
  bill_id: string;
  split_type: string;
  share_amount: number;
  remaining_amount: number;
  total_bill_amount: number;
  message: string;
}

export interface RazorpayOrderResult {
  razorpay_order_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  key_id: string;
  bill_id: string;
}

export interface PaymentResult {
  id: string;
  bill_id: string;
  payment_method: string;
  payment_gateway: string | null;
  transaction_reference: string | null;
  razorpay_order_id: string | null;
  amount: number;
  status: "pending" | "completed" | "failed" | "partially_paid" | "refunded";
  paid_at: string | null;
  notes: string | null;
}

/**
 * Customer taps "Request Bill"
 */
export async function requestBill(sessionToken: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/billing/request-bill`, {
    method: "POST",
    headers: {
      "X-Session-Token": sessionToken,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to request bill.");
  }
  return res.json();
}

/**
 * Customer fetches active bill for their dining session
 */
export async function fetchSessionBill(sessionToken: string): Promise<BillData | null> {
  const res = await fetch(`${API}/api/v1/billing/session-bill`, {
    headers: {
      "X-Session-Token": sessionToken,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export interface WaiterNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Waiter fetches real-time notifications and bill requests
 */
export async function fetchWaiterNotifications(token: string): Promise<WaiterNotification[]> {
  const res = await fetch(`${API}/api/v1/billing/notifications/waiter`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Waiter generates final bill
 */
export async function generateBill(
  token: string,
  orderId: string,
  discountAmount: number = 0,
  tipAmount: number = 0
): Promise<BillData> {
  const res = await fetch(`${API}/api/v1/billing/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: orderId,
      discount_amount: discountAmount,
      tip_amount: tipAmount,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to generate bill.");
  }
  return res.json();
}

/**
 * Fetch bill by ID
 */
export async function getBill(billId: string): Promise<BillData> {
  const res = await fetch(`${API}/api/v1/billing/bills/${billId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch bill.");
  }
  return res.json();
}

/**
 * Manager unlocks locked session
 */
export async function unlockSession(token: string, sessionId: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/billing/sessions/${sessionId}/unlock`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Only Manager can unlock session.");
  }
  return res.json();
}

/**
 * Calculate Split Bill
 */
export async function calculateSplitBill(params: SplitBillParams): Promise<SplitBillResult> {
  const res = await fetch(`${API}/api/v1/billing/split-calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to calculate split bill.");
  }
  return res.json();
}

/**
 * Create Razorpay Order
 */
export async function createRazorpayOrder(
  billId: string,
  amount?: number
): Promise<RazorpayOrderResult> {
  const res = await fetch(`${API}/api/v1/billing/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bill_id: billId, amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create Razorpay payment order.");
  }
  return res.json();
}

/**
 * Verify Razorpay Payment Signature
 */
export async function verifyRazorpayPayment(payload: {
  bill_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount?: number;
}): Promise<PaymentResult> {
  const res = await fetch(`${API}/api/v1/billing/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Payment verification failed.");
  }
  return res.json();
}

/**
 * Cashier confirms Cash Payment
 */
export async function confirmCashPayment(
  token: string,
  billId: string,
  amount: number,
  notes?: string
): Promise<PaymentResult> {
  const res = await fetch(`${API}/api/v1/billing/cash/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bill_id: billId, amount, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to record cash payment.");
  }
  return res.json();
}

/**
 * Dismiss a single notification
 */
export async function dismissNotification(token: string, notificationId: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/billing/notifications/${notificationId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { message: "" };
  return res.json();
}

/**
 * Clear all waiter notifications
 */
export async function clearAllNotifications(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/billing/notifications/waiter/clear-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { message: "" };
  return res.json();
}

/**
 * Get Printable HTML Invoice URL
 */
export function getInvoiceHtmlUrl(billId: string): string {
  return `${API}/api/v1/billing/invoices/${billId}/html`;
}
