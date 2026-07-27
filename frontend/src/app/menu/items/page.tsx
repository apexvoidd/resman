"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import { RouteGuard } from "@/components/RouteGuard";
import {
  Category,
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
  MenuItem,
  toggleMenuItemAvailability,
} from "@/services/menu";
import { getSafeImageUrl } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

function MenuItemListPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();
  const toast = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [priceSort, setPriceSort] = useState<"" | "asc" | "desc">("");

  const canManageMenu = hasRole("admin") || hasRole("manager");
  const canViewMenu = hasRole("waiter", "kitchen", "kitchen_staff", "chef", "cashier", "manager", "admin");

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const [catsRes, itemsRes] = await Promise.all([
        fetchCategories(token),
        fetchMenuItems(token, {
          search: search.trim() || undefined,
          category_id: selectedCategory || undefined,
          is_available:
            availabilityFilter === "available"
              ? true
              : availabilityFilter === "unavailable"
              ? false
              : undefined,
          sort_by_price: priceSort || undefined,
          page_size: 100,
        }),
      ]);

      setCategories(catsRes);
      setItems(itemsRes.items);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || !canViewMenu) return;
    loadData();
  }, [isLoading, canViewMenu, search, selectedCategory, availabilityFilter, priceSort]);

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const token = await getToken();
      if (!token) return;
      await toggleMenuItemAvailability(token, item.id, !item.is_available);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to update availability.");
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteMenuItem(token, itemId);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to delete item.");
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Menu Items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Restaurant Menu Catalog</h1>
            <p className="text-xs text-gray-400">Browse dishes, prices, preparation times, and dietary tags</p>
          </div>
          {canManageMenu && (
            <div className="flex items-center gap-3">
              <Link
                href="/menu/categories"
                className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition"
              >
                📂 Manage Categories
              </Link>
              <Link
                href="/menu/items/new"
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
              >
                + Add Menu Item
              </Link>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400">Search Dishes</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dish name..."
              className="mt-1 w-full rounded-xl bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400">Category Filter</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400">Availability</label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="mt-1 w-full rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="all">All Items</option>
              <option value="available">Available Only</option>
              <option value="unavailable">Unavailable Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400">Price Sort</label>
            <select
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value as "" | "asc" | "desc")}
              className="mt-1 w-full rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">Default Order</option>
              <option value="asc">Price: Low to High</option>
              <option value="desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
              No menu items match your search filters.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl transition hover:border-gray-700"
              >
                <div>
                  {/* Dish Image */}
                  <div className="relative h-44 w-full bg-gray-950 overflow-hidden flex items-center justify-center">
                    {getSafeImageUrl(item.image_url) ? (
                      <img
                        src={getSafeImageUrl(item.image_url)!}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          if (e.currentTarget.parentElement) {
                            const fallback = document.createElement("span");
                            fallback.className = "text-4xl";
                            fallback.innerText = "🍲";
                            e.currentTarget.parentElement.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-4xl">🍲</span>
                    )}

                    {/* Featured / Availability Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {item.is_featured && (
                        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold text-gray-950 shadow">
                          ★ Featured
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow ring-1 ${
                          item.is_available
                            ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                            : "bg-red-500/20 text-red-300 ring-red-500/30"
                        }`}
                      >
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          {item.category_name || "Uncategorized"}
                        </span>
                        <h3 className="text-base font-bold text-white">{item.name}</h3>
                      </div>
                      <span className="text-lg font-black text-emerald-400">₹{item.price.toFixed(2)}</span>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {item.description || "No description provided."}
                    </p>

                    {/* Prep Time & Spicy Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                      <span className="rounded-lg bg-gray-950 px-2 py-1 ring-1 ring-white/10">
                        ⏱️ {item.preparation_time_minutes} mins
                      </span>
                      {item.spicy_level > 0 && (
                        <span className="rounded-lg bg-red-500/10 px-2 py-1 text-red-400 ring-1 ring-red-500/20">
                          🌶️ Spicy {item.spicy_level}/5
                        </span>
                      )}
                      {item.is_vegetarian && (
                        <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-400 ring-1 ring-emerald-500/20">
                          🌱 Veg
                        </span>
                      )}
                      {item.is_vegan && (
                        <span className="rounded-lg bg-teal-500/10 px-2 py-1 text-teal-400 ring-1 ring-teal-500/20">
                          🌿 Vegan
                        </span>
                      )}
                      {item.is_jain && (
                        <span className="rounded-lg bg-orange-500/10 px-2 py-1 text-orange-400 ring-1 ring-orange-500/20">
                          🪷 Jain
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls for Managers & Admins */}
                {canManageMenu && (
                  <div className="flex items-center justify-between border-t border-gray-800 bg-gray-950 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(item)}
                      className={`text-xs font-semibold hover:underline ${
                        item.is_available ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {item.is_available ? "Disable Item" : "Enable Item"}
                    </button>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/menu/items/${item.id}/edit`}
                        className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuItemListWrapper() {
  return (
    <RouteGuard roles={["waiter", "kitchen", "kitchen_staff", "chef", "cashier", "manager", "admin"]}>
      <MenuItemListPage />
    </RouteGuard>
  );
}
