/**
 * API client for Kitchen Display System (KDS) workflows and order state transitions.
 */

import { OrderOut } from "@/services/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface FetchKDSParams {
  search?: string;
  status?: string;
  sort_by?: "oldest" | "newest" | "longest_waiting";
}

async function kdsFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}/api/v1/kds${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

export async function fetchKDSOrders(
  token: string,
  params: FetchKDSParams = {}
): Promise<OrderOut[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.sort_by) query.set("sort_by", params.sort_by);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await kdsFetch(`/orders${qs}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch KDS orders.");
  }
  return res.json();
}

export async function acceptOrder(
  token: string,
  orderId: string,
  estimatedPrepMinutes: number
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/accept`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimated_prep_minutes: estimatedPrepMinutes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to accept order.");
  }
  return res.json();
}

export async function startPreparing(
  token: string,
  orderId: string
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/preparing`, token, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to start preparation.");
  }
  return res.json();
}

export async function markOrderReady(
  token: string,
  orderId: string
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/ready`, token, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to mark order ready.");
  }
  return res.json();
}

export async function markOrderCompleted(
  token: string,
  orderId: string
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/complete`, token, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to complete order.");
  }
  return res.json();
}

export async function updatePrepTime(
  token: string,
  orderId: string,
  estimatedPrepMinutes: number
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/prep-time`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimated_prep_minutes: estimatedPrepMinutes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update prep time.");
  }
  return res.json();
}

export async function updatePriority(
  token: string,
  orderId: string,
  priority: "normal" | "high" | "urgent"
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/priority`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update priority.");
  }
  return res.json();
}

export async function pauseOrder(
  token: string,
  orderId: string,
  reason?: string
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/pause`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to pause order.");
  }
  return res.json();
}

export async function resumeOrder(
  token: string,
  orderId: string
): Promise<OrderOut> {
  const res = await kdsFetch(`/orders/${orderId}/resume`, token, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to resume order.");
  }
  return res.json();
}
