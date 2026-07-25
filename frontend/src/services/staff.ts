/**
 * API client for Staff Management endpoints.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface StaffMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone: string | null;
  is_active: boolean;
  clerk_user_id: string | null;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

export interface StaffListResponse {
  items: StaffMember[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StaffCreatePayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role_codes: string[];
  is_active?: boolean;
}

export interface StaffUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  role_codes?: string[];
  is_active?: boolean;
}

export interface StaffListParams {
  search?: string;
  role?: string;
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

export async function fetchStaffList(
  token: string,
  params: StaffListParams = {}
): Promise<StaffListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.is_active !== undefined && params.is_active !== null) {
    query.set("is_active", String(params.is_active));
  }
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));

  const queryString = query.toString() ? `?${query.toString()}` : "";
  const res = await authFetch(`/staff${queryString}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch staff members");
  }
  return res.json();
}

export async function fetchRoles(token: string): Promise<Role[]> {
  const res = await authFetch("/staff/roles", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch system roles");
  }
  return res.json();
}

export async function fetchStaffById(
  token: string,
  staffId: string
): Promise<StaffMember> {
  const res = await authFetch(`/staff/${staffId}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch staff member details");
  }
  return res.json();
}

export async function createStaff(
  token: string,
  payload: StaffCreatePayload
): Promise<StaffMember> {
  const res = await authFetch("/staff", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create staff member");
  }
  return res.json();
}

export async function updateStaff(
  token: string,
  staffId: string,
  payload: StaffUpdatePayload
): Promise<StaffMember> {
  const res = await authFetch(`/staff/${staffId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update staff member");
  }
  return res.json();
}

export async function toggleStaffStatus(
  token: string,
  staffId: string,
  isActive: boolean
): Promise<StaffMember> {
  const res = await authFetch(`/staff/${staffId}/status`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to toggle staff status");
  }
  return res.json();
}

export async function deleteStaff(
  token: string,
  staffId: string
): Promise<void> {
  const res = await authFetch(`/staff/${staffId}`, token, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to delete staff member");
  }
}
