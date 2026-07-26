const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TopSellingItem {
  name: string;
  quantity_sold: number;
  total_sales: number;
}

export interface ManagerOverview {
  today_revenue: number;
  paid_bills_count: number;
  total_orders_today: number;
  active_orders_count: number;
  total_tables: number;
  occupied_tables: number;
  occupancy_rate: number;
  low_stock_count: number;
  today_waste_cost: number;
  avg_csat: number;
  top_selling_items: TopSellingItem[];
}

export interface IngredientBreakdown {
  ingredient_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  current_stock: number;
}

export interface RecipeProfitabilityItem {
  recipe_id: string;
  menu_item_id: string;
  menu_item_name: string;
  selling_price: number;
  recipe_cost: number;
  gross_profit: number;
  margin_percent: number;
  max_makeable_portions: number;
  suggested_price_for_70pct_margin: number;
  ingredient_breakdown: IngredientBreakdown[];
  is_available: boolean;
}

async function managerFetch(path: string, token?: string | null, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}/api/v1/manager${path}`, { ...init, headers });
}

export async function fetchManagerOverview(token?: string | null): Promise<ManagerOverview> {
  const res = await managerFetch("/overview", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch manager overview.");
  }
  return res.json();
}

export async function fetchRecipeProfitability(token?: string | null): Promise<RecipeProfitabilityItem[]> {
  const res = await managerFetch("/recipe-profitability", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch recipe profitability.");
  }
  return res.json();
}

export async function broadcastManagerAnnouncement(
  token: string | null | undefined,
  title: string,
  message: string,
  priority: string = "urgent"
): Promise<{ message: string }> {
  const res = await managerFetch("/broadcast", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, priority }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to send broadcast.");
  }
  return res.json();
}

export async function bulkResetTables(token?: string | null): Promise<{ message: string; count: number }> {
  const res = await managerFetch("/bulk-table-reset", token, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to reset tables.");
  }
  return res.json();
}
