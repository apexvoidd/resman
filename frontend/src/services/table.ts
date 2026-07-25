/**
 * API client for Table Management endpoints.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type TableStatusType =
  | "available"
  | "reserved"
  | "awaiting_verification"
  | "occupied"
  | "billing"
  | "cleaning"
  | "out_of_service";

export interface DiningTable {
  id: string;
  branch_id: string;
  table_number: string;
  capacity: number;
  status: TableStatusType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableListResponse {
  items: DiningTable[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TableCreatePayload {
  table_number: string;
  capacity: number;
  status?: TableStatusType;
  description?: string | null;
  is_active?: boolean;
}

export interface TableUpdatePayload {
  table_number?: string;
  capacity?: number;
  status?: TableStatusType;
  description?: string | null;
  is_active?: boolean;
}

export interface TableListParams {
  search?: string;
  status?: string;
  capacity?: number;
  min_capacity?: number;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

async function authFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function fetchTableList(
  token: string,
  params: TableListParams = {}
): Promise<TableListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.capacity) query.set("capacity", String(params.capacity));
  if (params.min_capacity) query.set("min_capacity", String(params.min_capacity));
  if (params.is_active !== undefined && params.is_active !== null) {
    query.set("is_active", String(params.is_active));
  }
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));

  const queryString = query.toString() ? `?${query.toString()}` : "";
  const res = await authFetch(`/tables${queryString}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch dining tables");
  }
  return res.json();
}

export async function fetchTableById(
  token: string,
  tableId: string
): Promise<DiningTable> {
  const res = await authFetch(`/tables/${tableId}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch table details");
  }
  return res.json();
}

export async function createTable(
  token: string,
  payload: TableCreatePayload
): Promise<DiningTable> {
  const res = await authFetch("/tables", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create dining table");
  }
  return res.json();
}

export async function updateTable(
  token: string,
  tableId: string,
  payload: TableUpdatePayload
): Promise<DiningTable> {
  const res = await authFetch(`/tables/${tableId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update dining table");
  }
  return res.json();
}

export async function toggleTableStatus(
  token: string,
  tableId: string,
  payload: { is_active?: boolean; status?: TableStatusType }
): Promise<DiningTable> {
  const res = await authFetch(`/tables/${tableId}/status`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update table status");
  }
  return res.json();
}

export async function deleteTable(
  token: string,
  tableId: string
): Promise<void> {
  const res = await authFetch(`/tables/${tableId}`, token, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to delete dining table");
  }
}

export interface PendingVerificationTable {
  table_id: string;
  table_number: string;
  capacity: number;
  guest_session_id: string;
  guest_name?: string | null;
  guest_count: number;
  verification_requested_at?: string | null;
  time_elapsed_seconds: number;
}

export async function fetchPendingVerifications(
  token: string
): Promise<PendingVerificationTable[]> {
  const res = await authFetch("/tables/verification-requests", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch verification requests.");
  }
  return res.json();
}

export async function verifyCustomerArrival(
  token: string,
  tableId: string,
  action: "confirm" | "reject",
  reason?: string
): Promise<DiningTable> {
  const res = await authFetch(`/tables/${tableId}/verify`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Failed to ${action} arrival.`);
  }
  return res.json();
}

