"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import { fetchIngredients, IngredientOut } from "@/services/inventory";
import { fetchMenuItems, MenuItem } from "@/services/menu";
import {
  deleteRecipe,
  fetchAllRecipes,
  RecipeCreatePayload,
  RecipeIngredientInput,
  RecipeOut,
  saveRecipe,
} from "@/services/recipe";

export default function RecipesPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const isAuthorized = hasRole("kitchen_staff") || hasRole("manager") || hasRole("admin");
  const isManager = hasRole("manager") || hasRole("admin");

  const [recipes, setRecipes] = useState<RecipeOut[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<IngredientOut[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

  // Form State
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [recipeName, setRecipeName] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [yields, setYields] = useState<number>(1);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientInput[]>([
    { ingredient_id: "", quantity: 100, unit_of_measure: "g" },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const [recData, miData, ingData] = await Promise.all([
        fetchAllRecipes(token),
        fetchMenuItems(token),
        fetchIngredients(token, { is_active: true }),
      ]);

      setRecipes(recData);
      setMenuItems(miData.items || []);
      setAvailableIngredients(ingData);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load recipe data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || !isAuthorized) return;
    loadData();
  }, [isLoading, isAuthorized]);

  const openAddModal = () => {
    const firstItem = menuItems[0];
    setSelectedMenuItemId(firstItem?.id || "");
    setRecipeName(firstItem ? `Recipe for ${firstItem.name}` : "");
    setInstructions("");
    setYields(1);
    setRecipeIngredients([
      {
        ingredient_id: availableIngredients[0]?.id || "",
        quantity: 100,
        unit_of_measure: (availableIngredients[0]?.unit_of_measure as any) || "g",
      },
    ]);
    setShowModal(true);
  };

  const openEditModal = (rec: RecipeOut) => {
    setSelectedMenuItemId(rec.menu_item_id);
    setRecipeName(rec.name);
    setInstructions(rec.instructions || "");
    setYields(rec.yields);
    setRecipeIngredients(
      rec.ingredients.map((ri) => ({
        ingredient_id: ri.ingredient_id,
        quantity: ri.quantity,
        unit_of_measure: (ri.unit_of_measure as any) || "g",
      }))
    );
    setShowModal(true);
  };

  const handleAddIngredientRow = () => {
    const unselected = availableIngredients.find(
      (ing) => !recipeIngredients.some((ri) => ri.ingredient_id === ing.id)
    );
    const ingId = unselected?.id || availableIngredients[0]?.id || "";
    const unit = (unselected?.unit_of_measure as any) || "g";

    setRecipeIngredients([
      ...recipeIngredients,
      { ingredient_id: ingId, quantity: 100, unit_of_measure: unit },
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    if (recipeIngredients.length <= 1) {
      setErrorMsg("A recipe must contain at least 1 ingredient.");
      return;
    }
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredientInput,
    value: any
  ) => {
    const updated = [...recipeIngredients];
    if (field === "ingredient_id") {
      const targetIng = availableIngredients.find((i) => i.id === value);
      updated[index] = {
        ...updated[index],
        ingredient_id: value,
        unit_of_measure: (targetIng?.unit_of_measure as any) || updated[index].unit_of_measure,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setRecipeIngredients(updated);
  };

  const handleSaveRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemId) {
      setErrorMsg("Please select a menu item.");
      return;
    }

    // Duplicate ingredient check
    const seen = new Set<string>();
    for (const ri of recipeIngredients) {
      if (!ri.ingredient_id) {
        setErrorMsg("Please select valid ingredients for all rows.");
        return;
      }
      if (seen.has(ri.ingredient_id)) {
        setErrorMsg("Duplicate ingredients in a single recipe are not allowed.");
        return;
      }
      seen.add(ri.ingredient_id);
    }

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      const payload: RecipeCreatePayload = {
        menu_item_id: selectedMenuItemId,
        name: recipeName.trim() || "Menu Item Recipe",
        instructions: instructions.trim() || undefined,
        yields: yields,
        ingredients: recipeIngredients,
      };

      await saveRecipe(token, payload);
      setSuccessMsg("Recipe saved successfully! Menu availability auto-synchronized.");
      setShowModal(false);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to save recipe.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingRecipeId) return;

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await deleteRecipe(token, deletingRecipeId);
      setSuccessMsg("Recipe deleted successfully.");
      setDeletingRecipeId(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to delete recipe.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.menu_item_name && r.menu_item_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Recipe Management...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">📖</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Recipe Access Restricted</h2>
          <p className="mt-1 text-sm text-gray-400">
            Only Kitchen Staff, Managers, and Admins can view or manage recipes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📖</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Recipe Management</h1>
            </div>
            <p className="text-xs text-gray-400">
              Ingredient composition per menu item, portion availability, and automatic stock deduction
            </p>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
            >
              + Create New Recipe
            </button>
          )}
        </div>

        {/* System Messages */}
        {errorMsg && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-xs text-red-300">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-300">✕</button>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search Recipe or Menu Item Name..."
            className="w-full md:w-80 rounded-xl bg-gray-950 px-4 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          <span className="text-xs text-gray-400">Total Recipes: {recipes.length}</span>
        </div>

        {/* Recipe Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-sm text-gray-500">
              No recipes configured yet. Click "+ Create New Recipe" to attach ingredients to menu items!
            </div>
          ) : (
            filteredRecipes.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl transition hover:border-gray-700"
              >
                <div>
                  {/* Card Header */}
                  <div className="border-b border-gray-800 bg-gray-950 p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{rec.menu_item_name || rec.name}</h3>
                      <p className="text-[11px] text-gray-400">Yields: {rec.yields} portion(s)</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${
                        rec.is_available && rec.max_makeable_portions > 0
                          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                          : "bg-red-500/20 text-red-300 ring-red-500/40 animate-pulse"
                      }`}
                    >
                      {rec.is_available && rec.max_makeable_portions > 0
                        ? `Available (${rec.max_makeable_portions} Portions)`
                        : "Currently Unavailable"}
                    </span>
                  </div>

                  {/* Required Ingredients Breakdown */}
                  <div className="p-4 space-y-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Required Ingredients
                    </span>

                    <div className="space-y-2 divide-y divide-gray-800/60">
                      {rec.ingredients.map((ri) => {
                        const isStockLow = ri.current_stock < ri.quantity;
                        return (
                          <div key={ri.id} className="pt-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-white">{ri.ingredient_name}</span>
                              <p className="text-[11px] text-amber-400 font-mono">
                                {ri.quantity} {ri.unit_of_measure} / portion
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`font-mono text-[11px] font-bold ${
                                  isStockLow ? "text-red-400 animate-pulse" : "text-gray-300"
                                }`}
                              >
                                Stock: {ri.current_stock} {ri.unit_of_measure}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {rec.instructions && (
                      <div className="pt-2 border-t border-gray-800">
                        <span className="text-[11px] font-semibold text-gray-400">Instructions:</span>
                        <p className="text-xs text-gray-300 italic mt-0.5 line-clamp-3">{rec.instructions}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                {isManager && (
                  <div className="border-t border-gray-800 bg-gray-950 p-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(rec)}
                      className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
                    >
                      ✏️ Edit Recipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRecipeId(rec.id)}
                      className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 border border-red-500/30 transition"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE / EDIT RECIPE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveRecipeSubmit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Configure Menu Item Recipe</h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300">Target Menu Item *</label>
                  <select
                    value={selectedMenuItemId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMenuItemId(id);
                      const item = menuItems.find((m) => m.id === id);
                      if (item) setRecipeName(`Recipe for ${item.name}`);
                    }}
                    className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                  >
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (${m.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-300">Recipe Title *</label>
                  <input
                    type="text"
                    required
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Preparation Instructions (Optional)</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Marinate chicken for 30 mins, saute butter and tomatoes..."
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                  rows={2}
                />
              </div>

              {/* Dynamic Recipe Ingredient List */}
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">Recipe Ingredients Breakdown *</span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                  >
                    + Add Ingredient
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeIngredients.map((ri, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-xl bg-gray-950 p-2 border border-gray-800">
                      <select
                        value={ri.ingredient_id}
                        onChange={(e) => handleIngredientChange(index, "ingredient_id", e.target.value)}
                        className="w-1/2 rounded-lg bg-gray-900 px-3 py-1.5 text-white ring-1 ring-white/10 focus:outline-none"
                      >
                        <option value="">Select Ingredient</option>
                        {availableIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stock: {ing.current_stock} {ing.unit_of_measure})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        required
                        value={ri.quantity}
                        onChange={(e) =>
                          handleIngredientChange(index, "quantity", parseFloat(e.target.value) || 0)
                        }
                        placeholder="Quantity"
                        className="w-1/4 rounded-lg bg-gray-900 px-3 py-1.5 text-white ring-1 ring-white/10 focus:outline-none font-mono"
                      />

                      <select
                        value={ri.unit_of_measure}
                        onChange={(e) => handleIngredientChange(index, "unit_of_measure", e.target.value as any)}
                        className="w-1/4 rounded-lg bg-gray-900 px-3 py-1.5 text-white ring-1 ring-white/10 focus:outline-none"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(index)}
                        className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400"
              >
                Save Recipe
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingRecipeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4 text-center">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-base font-bold text-white">Delete Recipe?</h3>
            <p className="text-xs text-gray-400">
              Deleting this recipe will remove ingredient requirements for this menu item. Are you sure?
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecipeId(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-red-500 px-5 py-2 text-xs font-bold text-white hover:bg-red-400"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
