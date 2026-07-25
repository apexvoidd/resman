/**
 * API service client for Inventory Management, Ingredients CRUD, Restocking, Stock Adjustments, Waste, and Audit History.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface IngredientCategoryOut {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface IngredientOut {
  id: string;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  unit_of_measure: "kg" | "g" | "L" | "ml" | "pcs" | string;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  unit_cost: number;
  supplier?: string | null;
  is_active: boolean;
  version_id: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  created_at: string;
  updated_at: string;
}

export interface InventoryDashboardOut {
  total_ingredients: number;
  low_stock_count: number;
  out_of_stock_count: number;
  in_stock_count: number;
  total_inventory_value: number;
}

export interface StockHistoryOut {
  id: string;
  ingredient_id: string;
  ingredient_name?: string | null;
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  action_type: string;
  reason?: string | null;
  invoice_number?: string | null;
  supplier?: string | null;
  notes?: string | null;
  recorded_by_user_id?: string | null;
  recorded_by_name?: string | null;
  created_at: string;
}

export interface WasteRecordOut {
  id: string;
  ingredient_id?: string | null;
  ingredient_name?: string | null;
  quantity: number;
  reason: string;
  cost_impact: number;
  notes?: string | null;
  recorded_by_user_id?: string | null;
  recorded_by_name?: string | null;
  waste_date: string;
}

export interface IngredientCreatePayload {
  name: string;
  category_id?: string | null;
  unit_of_measure: "kg" | "g" | "L" | "ml" | "pcs";
  current_stock: number;
  minimum_stock: number;
  reorder_level?: number;
  unit_cost: number;
  supplier?: string;
  is_active?: boolean;
}

export interface IngredientUpdatePayload {
  name?: string;
  category_id?: string | null;
  unit_of_measure?: "kg" | "g" | "L" | "ml" | "pcs";
  minimum_stock?: number;
  reorder_level?: number;
  unit_cost?: number;
  supplier?: string;
  is_active?: boolean;
}

export interface RestockPayload {
  quantity: number;
  purchase_price: number;
  supplier?: string;
  invoice_number?: string;
  notes?: string;
}

export interface ManualAdjustmentPayload {
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: "Stock Count Correction" | "Damage" | "Expired" | "Testing" | "Other";
  notes?: string;
}

export interface WasteRecordPayload {
  quantity: number;
  reason: string;
  notes?: string;
}

export interface FetchIngredientsParams {
  search?: string;
  category_id?: string;
  stock_status?: "all" | "in_stock" | "low_stock" | "out_of_stock";
  is_active?: boolean;
  sort_by?: "name" | "stock_asc" | "stock_desc" | "cost";
}

async function inventoryFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}/api/v1/inventory${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

export async function fetchInventoryDashboard(token: string): Promise<InventoryDashboardOut> {
  const res = await inventoryFetch("/dashboard", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch inventory dashboard.");
  }
  return res.json();
}

export async function fetchCategories(token: string): Promise<IngredientCategoryOut[]> {
  const res = await inventoryFetch("/categories", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch ingredient categories.");
  }
  return res.json();
}

export async function createCategory(
  token: string,
  name: string,
  description?: string
): Promise<IngredientCategoryOut> {
  const res = await inventoryFetch("/categories", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to create category.");
  }
  return res.json();
}

export async function fetchIngredients(
  token: string,
  params: FetchIngredientsParams = {}
): Promise<IngredientOut[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.stock_status) query.set("stock_status", params.stock_status);
  if (params.is_active !== undefined) query.set("is_active", String(params.is_active));
  if (params.sort_by) query.set("sort_by", params.sort_by);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await inventoryFetch(`/ingredients${qs}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch ingredients.");
  }
  return res.json();
}

export async function createIngredient(
  token: string,
  payload: IngredientCreatePayload
): Promise<IngredientOut> {
  const res = await inventoryFetch("/ingredients", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to add ingredient.");
  }
  return res.json();
}

export async function updateIngredient(
  token: string,
  ingredientId: string,
  payload: IngredientUpdatePayload
): Promise<IngredientOut> {
  const res = await inventoryFetch(`/ingredients/${ingredientId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to update ingredient.");
  }
  return res.json();
}

export async function toggleIngredientStatus(
  token: string,
  ingredientId: string,
  isActive: boolean
): Promise<IngredientOut> {
  const res = await inventoryFetch(
    `/ingredients/${ingredientId}/status?is_active=${isActive}`,
    token,
    { method: "PATCH" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to toggle ingredient status.");
  }
  return res.json();
}

export async function restockIngredient(
  token: string,
  ingredientId: string,
  payload: RestockPayload
): Promise<IngredientOut> {
  const res = await inventoryFetch(`/ingredients/${ingredientId}/restock`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to restock ingredient.");
  }
  return res.json();
}

export async function adjustStock(
  token: string,
  ingredientId: string,
  payload: ManualAdjustmentPayload
): Promise<IngredientOut> {
  const res = await inventoryFetch(`/ingredients/${ingredientId}/adjust`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to adjust stock.");
  }
  return res.json();
}

export async function recordWaste(
  token: string,
  ingredientId: string,
  payload: WasteRecordPayload
): Promise<WasteRecordOut> {
  const res = await inventoryFetch(`/ingredients/${ingredientId}/waste`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to record waste.");
  }
  return res.json();
}

export async function fetchStockHistory(
  token: string,
  ingredientId?: string,
  limit: number = 100
): Promise<StockHistoryOut[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (ingredientId) query.set("ingredient_id", ingredientId);

  const res = await inventoryFetch(`/history?${query.toString()}`, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch stock audit history.");
  }
  return res.json();
}
