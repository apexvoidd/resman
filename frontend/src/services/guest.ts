/**
 * API client for Guest Sessions & Entrance QR Code Table Assignment.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface GuestSessionInit {
  session_token: string;
  expires_at: string;
  is_active: boolean;
}

export interface GuestFindTableInput {
  guest_count: number;
  name?: string;
  email?: string;
}

export interface GuestTableReservationResponse {
  session_token: string;
  assigned: boolean;
  table_id?: string | null;
  table_number?: string | null;
  capacity?: number | null;
  reservation_expires_at?: string | null;
  remaining_seconds?: number | null;
  verification_status?: string;
  rejection_reason?: string | null;
  menu_unlocked?: boolean;
  in_queue: boolean;
  queue_id?: string | null;
  queue_position?: number | null;
  estimated_wait_minutes?: number | null;
  cooldown_active?: boolean;
  cooldown_remaining_seconds?: number | null;
  message: string;
}

export interface GuestStatusResponse {
  session_token: string;
  guest_name?: string | null;
  guest_count?: number | null;
  has_active_reservation: boolean;
  table_id?: string | null;
  table_number?: string | null;
  capacity?: number | null;
  table_status?: string | null;
  reservation_expires_at?: string | null;
  remaining_seconds?: number | null;
  verification_status?: string;
  rejection_reason?: string | null;
  menu_unlocked?: boolean;
  in_queue: boolean;
  queue_id?: string | null;
  queue_position?: number | null;
  estimated_wait_minutes?: number | null;
  cooldown_active?: boolean;
  cooldown_remaining_seconds?: number | null;
  message: string;
}

async function guestFetch(
  path: string,
  sessionToken?: string | null,
  init?: RequestInit
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (sessionToken) {
    headers["X-Session-Token"] = sessionToken;
  }

  return fetch(`${API}/api/v1/guest${path}`, {
    ...init,
    headers,
  });
}

export async function initGuestSession(
  sessionToken?: string | null
): Promise<GuestSessionInit> {
  const res = await guestFetch("/session", sessionToken, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to initialize guest session.");
  }
  return res.json();
}

export async function findGuestTable(
  sessionToken: string,
  payload: GuestFindTableInput
): Promise<GuestTableReservationResponse> {
  const res = await guestFetch("/find-table", sessionToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to find table.");
  }
  return res.json();
}

export async function markAtTable(
  sessionToken: string
): Promise<GuestStatusResponse> {
  const res = await guestFetch("/at-table", sessionToken, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to notify table arrival.");
  }
  return res.json();
}

export async function cancelGuestReservation(
  sessionToken: string
): Promise<GuestStatusResponse> {
  const res = await guestFetch("/cancel", sessionToken, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to cancel reservation.");
  }
  return res.json();
}

export async function fetchGuestStatus(
  sessionToken: string
): Promise<GuestStatusResponse> {
  const res = await guestFetch("/status", sessionToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch status.");
  }
  return res.json();
}
