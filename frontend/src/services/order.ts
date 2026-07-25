/**
 * API client for Customer Cart & Ordering endpoints.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface OrderItemOut {
  id: string;
  menu_item_id: string;
  menu_item_name?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string | null;
}

export interface OrderOut {
  id: string;
  order_number: string;
  status: string;
  table_id?: string | null;
  table_number?: string | null;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  notes?: string | null;
  items: OrderItemOut[];
  can_edit: boolean;
  can_cancel: boolean;
  status_message: string;
  created_at: string;
  updated_at: string;
}

export interface PlaceOrderItemPayload {
  menu_item_id: string;
  quantity: number;
  special_instructions?: string;
}

async function orderFetch(
  path: string,
  sessionToken: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}/api/v1/orders${path}`, {
    ...init,
    headers: {
      "X-Session-Token": sessionToken,
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

export async function placeOrder(
  sessionToken: string,
  items: PlaceOrderItemPayload[],
  notes?: string
): Promise<OrderOut> {
  const res = await orderFetch("", sessionToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to place order.");
  }
  return res.json();
}

export async function fetchSessionOrders(
  sessionToken: string
): Promise<OrderOut[]> {
  const res = await orderFetch("/session", sessionToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch session orders.");
  }
  return res.json();
}

export async function updateOrder(
  sessionToken: string,
  orderId: string,
  items: PlaceOrderItemPayload[],
  notes?: string
): Promise<OrderOut> {
  const res = await orderFetch(`/${orderId}`, sessionToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update order.");
  }
  return res.json();
}

export async function cancelOrder(
  sessionToken: string,
  orderId: string
): Promise<OrderOut> {
  const res = await orderFetch(`/${orderId}/cancel`, sessionToken, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to cancel order.");
  }
  return res.json();
}
