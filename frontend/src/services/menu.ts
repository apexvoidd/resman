/**
 * API Client for Category and Menu Item Management & Customer Menu Browsing.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  category_name?: string | null;
  name: string;
  description: string | null;
  price: number;
  preparation_time_minutes: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_jain: boolean;
  spicy_level: number;
  display_order: number;
  average_rating?: number | null;
  total_ratings?: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItemListResponse {
  items: MenuItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MenuItemCreateParams {
  name: string;
  category_id: string;
  description?: string | null;
  price: number;
  preparation_time_minutes?: number;
  image_url?: string | null;
  is_available?: boolean;
  is_featured?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_jain?: boolean;
  spicy_level?: number;
  display_order?: number;
}

export interface MenuItemUpdateParams {
  name?: string;
  category_id?: string;
  description?: string | null;
  price?: number;
  preparation_time_minutes?: number;
  image_url?: string | null;
  is_available?: boolean;
  is_featured?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_jain?: boolean;
  spicy_level?: number;
  display_order?: number;
}

export interface FetchMenuItemsParams {
  search?: string;
  category_id?: string;
  is_available?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_jain?: boolean;
  sort_by_price?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

async function apiFetch(
  path: string,
  token?: string | null,
  init?: RequestInit
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API}/api/v1/menu${path}`, {
    ...init,
    headers,
  });
}

// --- CATEGORY FUNCTIONS ---

export async function fetchCategories(
  token?: string | null,
  isActive?: boolean
): Promise<Category[]> {
  const query = new URLSearchParams();
  if (isActive !== undefined) query.set("is_active", String(isActive));

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch(`/categories${qs}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch categories.");
  }
  return res.json();
}

export async function createCategory(
  token: string,
  payload: { name: string; description?: string | null; display_order?: number; is_active?: boolean }
): Promise<Category> {
  const res = await apiFetch("/categories", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create category.");
  }
  return res.json();
}

export async function updateCategory(
  token: string,
  categoryId: string,
  payload: { name?: string; description?: string | null; display_order?: number; is_active?: boolean }
): Promise<Category> {
  const res = await apiFetch(`/categories/${categoryId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update category.");
  }
  return res.json();
}

export async function toggleCategoryStatus(
  token: string,
  categoryId: string,
  isActive: boolean
): Promise<Category> {
  const res = await apiFetch(`/categories/${categoryId}/status?is_active=${isActive}`, token, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update category status.");
  }
  return res.json();
}

// --- MENU ITEM FUNCTIONS ---

export async function fetchMenuItems(
  token?: string | null,
  params: FetchMenuItemsParams = {}
): Promise<MenuItemListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.is_available !== undefined) query.set("is_available", String(params.is_available));
  if (params.is_vegetarian) query.set("is_vegetarian", "true");
  if (params.is_vegan) query.set("is_vegan", "true");
  if (params.is_jain) query.set("is_jain", "true");
  if (params.sort_by_price) query.set("sort_by_price", params.sort_by_price);
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch(`/items${qs}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch menu items.");
  }
  return res.json();
}

export async function fetchMenuItemById(
  token: string | null | undefined,
  itemId: string
): Promise<MenuItem> {
  const res = await apiFetch(`/items/${itemId}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch menu item details.");
  }
  return res.json();
}

export async function createMenuItem(
  token: string,
  payload: MenuItemCreateParams
): Promise<MenuItem> {
  const res = await apiFetch("/items", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create menu item.");
  }
  return res.json();
}

export async function updateMenuItem(
  token: string,
  itemId: string,
  payload: MenuItemUpdateParams
): Promise<MenuItem> {
  const res = await apiFetch(`/items/${itemId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update menu item.");
  }
  return res.json();
}

export async function toggleMenuItemAvailability(
  token: string,
  itemId: string,
  isAvailable: boolean
): Promise<MenuItem> {
  const res = await apiFetch(`/items/${itemId}/availability?is_available=${isAvailable}`, token, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update availability.");
  }
  return res.json();
}

export async function deleteMenuItem(
  token: string,
  itemId: string
): Promise<void> {
  const res = await apiFetch(`/items/${itemId}`, token, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to delete menu item.");
  }
}

export async function uploadMenuItemImage(
  token: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch("/items/image", token, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to upload image.");
  }
  const data = await res.json();
  return data.image_url;
}
