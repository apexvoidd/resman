/**
 * API service client for Recipe Management and Menu Item Ingredient Composition.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface RecipeIngredientInput {
  ingredient_id: string;
  quantity: number;
  unit_of_measure: "kg" | "g" | "L" | "ml" | "pcs";
}

export interface RecipeIngredientOut {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit_of_measure: string;
  current_stock: number;
  minimum_stock: number;
  unit_cost: number;
}

export interface RecipeCreatePayload {
  menu_item_id: string;
  name: string;
  instructions?: string;
  yields?: number;
  ingredients: RecipeIngredientInput[];
}

export interface RecipeOut {
  id: string;
  menu_item_id: string;
  menu_item_name?: string | null;
  name: string;
  instructions?: string | null;
  yields: number;
  ingredients: RecipeIngredientOut[];
  max_makeable_portions: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

async function recipeFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}/api/v1/recipes${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

export async function fetchAllRecipes(token: string): Promise<RecipeOut[]> {
  const res = await recipeFetch("", token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch recipes.");
  }
  return res.json();
}

export async function fetchRecipeByMenuItemId(
  token: string,
  menuItemId: string
): Promise<RecipeOut | null> {
  const res = await recipeFetch(`/menu-item/${menuItemId}`, token);
  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to fetch recipe.");
  }
  return res.json();
}

export async function saveRecipe(
  token: string,
  payload: RecipeCreatePayload
): Promise<RecipeOut> {
  const res = await recipeFetch("", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to save recipe.");
  }
  return res.json();
}

export async function deleteRecipe(
  token: string,
  recipeId: string
): Promise<void> {
  const res = await recipeFetch(`/${recipeId}`, token, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to delete recipe.");
  }
}
