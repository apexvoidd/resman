"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import {
  adjustStock,
  createCategory,
  createIngredient,
  fetchCategories,
  fetchIngredients,
  fetchInventoryDashboard,
  fetchStockHistory,
  IngredientCategoryOut,
  IngredientCreatePayload,
  IngredientOut,
  InventoryDashboardOut,
  ManualAdjustmentPayload,
  recordWaste,
  restockIngredient,
  RestockPayload,
  StockHistoryOut,
  toggleIngredientStatus,
  updateIngredient,
  WasteRecordPayload,
} from "@/services/inventory";

function InventoryPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const isAuthorized = hasRole("kitchen_staff") || hasRole("manager") || hasRole("admin");

  // State
  const [dashboard, setDashboard] = useState<InventoryDashboardOut | null>(null);
  const [ingredients, setIngredients] = useState<IngredientOut[]>([]);
  const [categories, setCategories] = useState<IngredientCategoryOut[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistoryOut[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "stock_asc" | "stock_desc" | "cost">("name");
  const [activeFilter, setActiveFilter] = useState<string>("all"); // all, active, inactive

  // Tabs
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");

  // Action / Modal states
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientOut | null>(null);

  const [restockingIngredient, setRestockingIngredient] = useState<IngredientOut | null>(null);
  const [adjustingIngredient, setAdjustingIngredient] = useState<IngredientOut | null>(null);
  const [wastingIngredient, setWastingIngredient] = useState<IngredientOut | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);

  // Form inputs
  const [ingForm, setIngForm] = useState<IngredientCreatePayload>({
    name: "",
    category_id: "",
    unit_of_measure: "kg",
    current_stock: 0,
    minimum_stock: 0,
    reorder_level: 0,
    unit_cost: 0,
    supplier: "",
    is_active: true,
  });

  const [catName, setCatName] = useState<string>("");
  const [catDesc, setCatDesc] = useState<string>("");

  const [restockForm, setRestockForm] = useState<RestockPayload>({
    quantity: 1,
    purchase_price: 0,
    supplier: "",
    invoice_number: "",
    notes: "",
  });

  const [adjustForm, setAdjustForm] = useState<ManualAdjustmentPayload>({
    adjustment_type: "increase",
    quantity: 1,
    reason: "Stock Count Correction",
    notes: "",
  });

  const [wasteForm, setWasteForm] = useState<WasteRecordPayload>({
    quantity: 1,
    reason: "Expired",
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const [dashData, catData, ingData] = await Promise.all([
        fetchInventoryDashboard(token),
        fetchCategories(token),
        fetchIngredients(token, {
          search: search.trim() || undefined,
          category_id: selectedCategory || undefined,
          stock_status: stockStatusFilter as any,
          is_active: activeFilter === "all" ? undefined : activeFilter === "active",
          sort_by: sortBy,
        }),
      ]);

      setDashboard(dashData);
      setCategories(catData);
      setIngredients(ingData);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const historyData = await fetchStockHistory(token, undefined, 100);
      setStockHistory(historyData);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load stock history.");
    }
  };

  useEffect(() => {
    if (isLoading || !isAuthorized) return;
    loadData();
  }, [isLoading, isAuthorized, search, selectedCategory, stockStatusFilter, sortBy, activeFilter]);

  useEffect(() => {
    if (activeTab === "history" && isAuthorized) {
      loadHistory();
    }
  }, [activeTab, isAuthorized]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await createCategory(token, catName.trim(), catDesc.trim() || undefined);
      setCatName("");
      setCatDesc("");
      setShowCategoryModal(false);
      setSuccessMsg("Category created successfully!");
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to create category.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      if (editingIngredient) {
        await updateIngredient(token, editingIngredient.id, {
          name: ingForm.name,
          category_id: ingForm.category_id || null,
          unit_of_measure: ingForm.unit_of_measure,
          minimum_stock: ingForm.minimum_stock,
          reorder_level: ingForm.reorder_level,
          unit_cost: ingForm.unit_cost,
          supplier: ingForm.supplier,
          is_active: ingForm.is_active,
        });
        setSuccessMsg(`Ingredient '${ingForm.name}' updated successfully.`);
      } else {
        await createIngredient(token, {
          ...ingForm,
          category_id: ingForm.category_id || null,
        });
        setSuccessMsg(`Ingredient '${ingForm.name}' added to inventory.`);
      }

      setShowAddModal(false);
      setEditingIngredient(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to save ingredient.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (ing: IngredientOut) => {
    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      const newStatus = !ing.is_active;
      await toggleIngredientStatus(token, ing.id, newStatus);
      setSuccessMsg(`Ingredient '${ing.name}' ${newStatus ? "enabled" : "disabled"}.`);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to toggle status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockingIngredient) return;

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await restockIngredient(token, restockingIngredient.id, restockForm);
      setSuccessMsg(`Restocked ${restockForm.quantity} ${restockingIngredient.unit_of_measure} of ${restockingIngredient.name}.`);
      setRestockingIngredient(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to restock ingredient.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingIngredient) return;

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await adjustStock(token, adjustingIngredient.id, adjustForm);
      setSuccessMsg(`Adjusted stock for ${adjustingIngredient.name}.`);
      setAdjustingIngredient(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to adjust stock.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wastingIngredient) return;

    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await recordWaste(token, wastingIngredient.id, wasteForm);
      setSuccessMsg(`Recorded waste of ${wasteForm.quantity} ${wastingIngredient.unit_of_measure} for ${wastingIngredient.name}.`);
      setWastingIngredient(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to record waste.");
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (ing: IngredientOut) => {
    setEditingIngredient(ing);
    setIngForm({
      name: ing.name,
      category_id: ing.category_id || "",
      unit_of_measure: (ing.unit_of_measure as any) || "kg",
      current_stock: ing.current_stock,
      minimum_stock: ing.minimum_stock,
      reorder_level: ing.reorder_level,
      unit_cost: ing.unit_cost,
      supplier: ing.supplier || "",
      is_active: ing.is_active,
    });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingIngredient(null);
    setIngForm({
      name: "",
      category_id: categories[0]?.id || "",
      unit_of_measure: "kg",
      current_stock: 0,
      minimum_stock: 5,
      reorder_level: 10,
      unit_cost: 0,
      supplier: "",
      is_active: true,
    });
    setShowAddModal(true);
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Ingredient Inventory...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">📦</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Inventory Access Restricted</h2>
          <p className="mt-1 text-sm text-gray-400">
            Only Kitchen Staff, Managers, and Admins can access inventory management.
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
              <span className="text-2xl">📦</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Ingredient Inventory</h1>
            </div>
            <p className="text-xs text-gray-400">
              Raw ingredient stock levels, low-stock warnings, restocking, manual adjustments, and waste records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="rounded-xl border border-gray-700 bg-gray-900 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition"
            >
              🏷️ Add Category
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
            >
              + Add Ingredient
            </button>
          </div>
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

        {/* Dashboard Cards */}
        {dashboard && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-lg">
              <span className="text-xs font-semibold text-gray-400">Total Ingredients</span>
              <p className="mt-2 text-2xl font-extrabold text-white">{dashboard.total_ingredients}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg">
              <span className="text-xs font-bold text-amber-400">Low Stock Alert</span>
              <p className="mt-2 text-2xl font-extrabold text-amber-300">{dashboard.low_stock_count}</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-lg">
              <span className="text-xs font-bold text-red-400">Out of Stock</span>
              <p className="mt-2 text-2xl font-extrabold text-red-300">{dashboard.out_of_stock_count}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg">
              <span className="text-xs font-bold text-emerald-400">In Stock</span>
              <p className="mt-2 text-2xl font-extrabold text-emerald-300">{dashboard.in_stock_count}</p>
            </div>
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 shadow-lg">
              <span className="text-xs font-bold text-sky-400">Total Stock Value</span>
              <p className="mt-2 text-2xl font-extrabold text-sky-300">₹{dashboard.total_inventory_value.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Main Tab Bar */}
        <div className="flex border-b border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition ${
              activeTab === "inventory"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            📦 Inventory Items ({ingredients.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition ${
              activeTab === "history"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            📜 Stock Audit History
          </button>
        </div>

        {activeTab === "inventory" ? (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search Ingredient Name..."
                className="w-full md:w-64 rounded-xl bg-gray-950 px-4 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value)}
                  className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">⚠️ Low Stock</option>
                  <option value="out_of_stock">🚨 Out of Stock</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="stock_asc">Sort: Stock Level (Lowest)</option>
                  <option value="stock_desc">Sort: Stock Level (Highest)</option>
                  <option value="cost">Sort: Unit Cost (Highest)</option>
                </select>

                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="all">Status: Active & Inactive</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Inventory List Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-800 bg-gray-950 text-gray-400 font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Ingredient Name</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Current Stock</th>
                      <th className="px-4 py-3.5">Min Stock</th>
                      <th className="px-4 py-3.5">Unit Cost</th>
                      <th className="px-4 py-3.5">Total Value</th>
                      <th className="px-4 py-3.5">Supplier</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {ingredients.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          No ingredients found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      ingredients.map((ing) => {
                        const totalVal = ing.current_stock * ing.unit_cost;
                        return (
                          <tr key={ing.id} className="hover:bg-gray-800/40 transition">
                            <td className="px-5 py-3.5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span>{ing.name}</span>
                                {!ing.is_active && (
                                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                                    Disabled
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-300">{ing.category_name || "Uncategorized"}</td>
                            <td className="px-4 py-3.5 font-mono">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">
                                  {ing.current_stock} {ing.unit_of_measure}
                                </span>
                                {ing.stock_status === "out_of_stock" && (
                                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black text-red-400 ring-1 ring-red-500/40 animate-pulse">
                                    Out of Stock
                                  </span>
                                )}
                                {ing.stock_status === "low_stock" && (
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 ring-1 ring-amber-500/40">
                                    Low Stock
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-400 font-mono">
                              {ing.minimum_stock} {ing.unit_of_measure}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-gray-300">₹{ing.unit_cost.toFixed(2)}</td>
                            <td className="px-4 py-3.5 font-mono font-bold text-purple-300">
                              ₹{totalVal.toFixed(2)}
                            </td>
                            <td className="px-4 py-3.5 text-gray-400">{ing.supplier || "—"}</td>
                            <td className="px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(ing)}
                                disabled={actionLoading}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                                  ing.is_active
                                    ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-gray-800 text-gray-400 ring-1 ring-gray-700 hover:bg-gray-700"
                                }`}
                              >
                                {ing.is_active ? "Active" : "Inactive"}
                              </button>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockingIngredient(ing);
                                    setRestockForm({
                                      quantity: 5,
                                      purchase_price: ing.unit_cost,
                                      supplier: ing.supplier || "",
                                      invoice_number: "",
                                      notes: "",
                                    });
                                  }}
                                  className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition border border-emerald-500/30"
                                >
                                  + Restock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdjustingIngredient(ing);
                                    setAdjustForm({
                                      adjustment_type: "increase",
                                      quantity: 1,
                                      reason: "Stock Count Correction",
                                      notes: "",
                                    });
                                  }}
                                  className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-400 hover:bg-blue-500/20 transition border border-blue-500/30"
                                >
                                  ⚙️ Adjust
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWastingIngredient(ing);
                                    setWasteForm({
                                      quantity: 1,
                                      reason: "Spoilage/Expired",
                                      notes: "",
                                    });
                                  }}
                                  className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition border border-red-500/30"
                                >
                                  🗑️ Waste
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(ing)}
                                  className="rounded-lg bg-gray-800 px-2 py-1 text-[11px] font-semibold text-gray-300 hover:bg-gray-700 transition"
                                >
                                  ✏️ Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Stock Audit History Tab */
          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Stock Change History Audit Trail</h3>
              <button
                type="button"
                onClick={loadHistory}
                className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              >
                🔄 Refresh History
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-800 bg-gray-950 text-gray-400 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Ingredient</th>
                    <th className="px-4 py-3.5">Action Type</th>
                    <th className="px-4 py-3.5">Prev Stock</th>
                    <th className="px-4 py-3.5">Change</th>
                    <th className="px-4 py-3.5">New Stock</th>
                    <th className="px-4 py-3.5">Reason / Invoice</th>
                    <th className="px-5 py-3.5">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {stockHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        No audit history records available.
                      </td>
                    </tr>
                  ) : (
                    stockHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-800/40 transition">
                        <td className="px-5 py-3.5 text-gray-400 font-mono whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">{h.ingredient_name || "Ingredient"}</td>
                        <td className="px-4 py-3.5 uppercase font-mono text-[10px]">
                          <span
                            className={`rounded-full px-2 py-0.5 font-black ring-1 ${
                              h.action_type === "restock"
                                ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                                : h.action_type === "waste" || h.action_type === "adjustment_decrease"
                                ? "bg-red-500/20 text-red-300 ring-red-500/40"
                                : "bg-blue-500/20 text-blue-300 ring-blue-500/40"
                            }`}
                          >
                            {h.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-gray-400">{h.previous_quantity}</td>
                        <td className="px-4 py-3.5 font-mono font-bold">
                          <span className={h.change_amount >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {h.change_amount >= 0 ? `+${h.change_amount}` : h.change_amount}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-white">{h.new_quantity}</td>
                        <td className="px-4 py-3.5 text-gray-300">
                          {h.reason || h.invoice_number || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400">{h.recorded_by_name || "System"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT INGREDIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveIngredient}
            className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">
              {editingIngredient ? "Edit Ingredient Configuration" : "Add New Raw Ingredient"}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block font-semibold text-gray-300">Ingredient Name *</label>
                <input
                  type="text"
                  required
                  value={ingForm.name}
                  onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
                  placeholder="e.g. Fresh Tomatoes"
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Category</label>
                <select
                  value={ingForm.category_id || ""}
                  onChange={(e) => setIngForm({ ...ingForm, category_id: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Unit of Measure *</label>
                <select
                  value={ingForm.unit_of_measure}
                  onChange={(e) => setIngForm({ ...ingForm, unit_of_measure: e.target.value as any })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="kg">kg (Kilograms)</option>
                  <option value="g">g (Grams)</option>
                  <option value="L">L (Liters)</option>
                  <option value="ml">ml (Milliliters)</option>
                  <option value="pcs">pcs (Pieces)</option>
                </select>
              </div>

              {!editingIngredient && (
                <div>
                  <label className="block font-semibold text-gray-300">Initial Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={ingForm.current_stock}
                    onChange={(e) => setIngForm({ ...ingForm, current_stock: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-300">Minimum Stock Alert *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={ingForm.minimum_stock}
                  onChange={(e) => setIngForm({ ...ingForm, minimum_stock: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Cost Per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={ingForm.unit_cost}
                  onChange={(e) => setIngForm({ ...ingForm, unit_cost: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Supplier Name (Optional)</label>
                <input
                  type="text"
                  value={ingForm.supplier || ""}
                  onChange={(e) => setIngForm({ ...ingForm, supplier: e.target.value })}
                  placeholder="e.g. Fresh Produce Co."
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingIngredient(null);
                }}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400"
              >
                Save Ingredient
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {restockingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRestockSubmit}
            className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Restock Ingredient</h3>
            <p className="text-xs text-gray-400">
              Adding shipment stock for <strong className="text-amber-400">{restockingIngredient.name}</strong> (Current: {restockingIngredient.current_stock} {restockingIngredient.unit_of_measure})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300">Quantity to Add ({restockingIngredient.unit_of_measure}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm({ ...restockForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Purchase Price / Unit (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={restockForm.purchase_price}
                  onChange={(e) => setRestockForm({ ...restockForm, purchase_price: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Supplier Name</label>
                <input
                  type="text"
                  value={restockForm.supplier}
                  onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })}
                  placeholder="e.g. Metro Produce Wholesale"
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Invoice Number (Optional)</label>
                <input
                  type="text"
                  value={restockForm.invoice_number}
                  onChange={(e) => setRestockForm({ ...restockForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-998231"
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setRestockingIngredient(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-emerald-400"
              >
                Confirm Restock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUAL ADJUSTMENT MODAL */}
      {adjustingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAdjustSubmit}
            className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Manual Stock Adjustment</h3>
            <p className="text-xs text-gray-400">
              Adjusting stock for <strong className="text-amber-400">{adjustingIngredient.name}</strong> (Current: {adjustingIngredient.current_stock} {adjustingIngredient.unit_of_measure})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300">Adjustment Type *</label>
                <div className="mt-1.5 flex gap-3">
                  <label className="flex items-center gap-2 text-gray-200">
                    <input
                      type="radio"
                      name="adj_type"
                      checked={adjustForm.adjustment_type === "increase"}
                      onChange={() => setAdjustForm({ ...adjustForm, adjustment_type: "increase" })}
                    />
                    ➕ Increase Stock
                  </label>
                  <label className="flex items-center gap-2 text-gray-200">
                    <input
                      type="radio"
                      name="adj_type"
                      checked={adjustForm.adjustment_type === "decrease"}
                      onChange={() => setAdjustForm({ ...adjustForm, adjustment_type: "decrease" })}
                    />
                    ➖ Decrease Stock
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Quantity ({adjustingIngredient.unit_of_measure}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Required Reason *</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value as any })}
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                >
                  <option value="Stock Count Correction">Stock Count Correction</option>
                  <option value="Damage">Damage</option>
                  <option value="Expired">Expired</option>
                  <option value="Testing">Testing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Additional Notes</label>
                <textarea
                  value={adjustForm.notes || ""}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Explain why stock level is adjusted..."
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2 text-white ring-1 ring-white/10 focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setAdjustingIngredient(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-blue-500 px-5 py-2 text-xs font-bold text-white hover:bg-blue-400"
              >
                Apply Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD WASTE MODAL */}
      {wastingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleWasteSubmit}
            className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Record Ingredient Waste</h3>
            <p className="text-xs text-gray-400">
              Recording waste for <strong className="text-red-400">{wastingIngredient.name}</strong> (Unit cost: ₹{wastingIngredient.unit_cost.toFixed(2)})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Wasted Quantity ({wastingIngredient.unit_of_measure}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max={wastingIngredient.current_stock}
                  required
                  value={wasteForm.quantity}
                  onChange={(e) => setWasteForm({ ...wasteForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-800 bg-gray-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Available stock: {wastingIngredient.current_stock} {wastingIngredient.unit_of_measure}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Reason for Waste *
                </label>
                <select
                  value={wasteForm.reason}
                  onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  className="w-full rounded-xl border border-gray-800 bg-gray-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Spoilage/Expired">Spoilage / Expired</option>
                  <option value="Spill/Damage">Spill / Damage</option>
                  <option value="Preparation Mistake">Preparation Mistake</option>
                  <option value="Quality Control">Quality Control Rejection</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  value={wasteForm.notes || ""}
                  onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
                  placeholder="e.g. Fridge temperature fluctuation"
                  className="w-full rounded-xl border border-gray-800 bg-gray-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs flex justify-between items-center text-red-300">
                <span>Calculated Waste Cost Impact:</span>
                <strong className="font-extrabold text-sm text-red-400">
                  ₹{(wasteForm.quantity * wastingIngredient.unit_cost).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setWastingIngredient(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-red-500 px-5 py-2 text-xs font-bold text-white hover:bg-red-400"
              >
                Record Waste
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateCategory}
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Add New Ingredient Category</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Seafood"
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300">Description (Optional)</label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="e.g. Fresh ocean fish and shellfish"
                  className="mt-1 w-full rounded-xl bg-gray-950 px-3.5 py-2.5 text-white ring-1 ring-white/10 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function InventoryPageWrapper() {
  return (
    <RouteGuard permission="inventory:view">
      <InventoryPage />
    </RouteGuard>
  );
}
