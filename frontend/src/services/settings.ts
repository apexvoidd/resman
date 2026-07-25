/**
 * API helpers for the restaurant settings endpoints.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface RestaurantSettings {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  settings_id: string | null;
  gst_number: string | null;
  currency: string;
  timezone: string;
  tax_percentage: number;
  service_charge_percentage: number;
  reservation_timeout_minutes: number;
  queue_timeout_minutes: number;
  opening_time: string | null;
  closing_time: string | null;
  updated_at: string;
}

export type SettingsUpdatePayload = Partial<
  Omit<RestaurantSettings, "id" | "settings_id" | "updated_at" | "logo_url">
>;

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

export async function fetchSettings(token: string): Promise<RestaurantSettings> {
  const res = await authFetch("/settings", token);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(
  token: string,
  payload: SettingsUpdatePayload
): Promise<RestaurantSettings> {
  const res = await authFetch("/settings", token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update settings");
  }
  return res.json();
}

export async function uploadLogo(
  token: string,
  file: File
): Promise<{ logo_url: string; message: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch("/settings/logo", token, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Logo upload failed");
  }
  return res.json();
}
