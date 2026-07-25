"use client";

import { useEffect, useState } from "react";
import {
  Category,
  fetchCategories,
  fetchMenuItems,
  MenuItem,
} from "@/services/menu";

export default function PublicMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isVegetarian, setIsVegetarian] = useState<boolean>(false);
  const [isVegan, setIsVegan] = useState<boolean>(false);
  const [isJain, setIsJain] = useState<boolean>(false);
  const [priceSort, setPriceSort] = useState<"" | "asc" | "desc">("");

  // Selected dish details modal
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [catsData, itemsData] = await Promise.all([
          fetchCategories(null, true),
          fetchMenuItems(null, {
            search: search.trim() || undefined,
            category_id: selectedCategory || undefined,
            is_vegetarian: isVegetarian || undefined,
            is_vegan: isVegan || undefined,
            is_jain: isJain || undefined,
            sort_by_price: priceSort || undefined,
            page_size: 100,
          }),
        ]);

        setCategories(catsData);
        setItems(itemsData.items);
        setErrorMsg(null);
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "Failed to load restaurant menu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [search, selectedCategory, isVegetarian, isVegan, isJain, priceSort]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-xl font-bold text-amber-400 ring-1 ring-amber-500/20">
              📖
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Restaurant Digital Menu</h1>
              <p className="text-xs text-gray-400">Explore our chef specials, appetizers, and beverages</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Category Horizontal Nav Pills */}
        <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory("")}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition ${
              selectedCategory === ""
                ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/10"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/10"
                  : "bg-gray-900 text-gray-400 hover:text-white"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search & Dietary Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-gray-800 bg-gray-900/90 p-4 backdrop-blur">
          {/* Search Input */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search dishes..."
              className="w-full rounded-xl bg-gray-950 px-4 py-2.5 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Dietary Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsVegetarian(!isVegetarian)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ring-1 ${
                isVegetarian
                  ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40"
                  : "bg-gray-950 text-gray-400 ring-white/10 hover:text-white"
              }`}
            >
              🌱 Veg
            </button>
            <button
              type="button"
              onClick={() => setIsVegan(!isVegan)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ring-1 ${
                isVegan
                  ? "bg-teal-500/20 text-teal-400 ring-teal-500/40"
                  : "bg-gray-950 text-gray-400 ring-white/10 hover:text-white"
              }`}
            >
              🌿 Vegan
            </button>
            <button
              type="button"
              onClick={() => setIsJain(!isJain)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ring-1 ${
                isJain
                  ? "bg-orange-500/20 text-orange-400 ring-orange-500/40"
                  : "bg-gray-950 text-gray-400 ring-white/10 hover:text-white"
              }`}
            >
              🪷 Jain
            </button>

            {/* Price Sort */}
            <select
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value as "" | "asc" | "desc")}
              className="rounded-xl bg-gray-950 px-3 py-1.5 text-xs text-white ring-1 ring-white/10 focus:outline-none"
            >
              <option value="">Sort Price</option>
              <option value="asc">₹ Low to High</option>
              <option value="desc">₹ High to Low</option>
            </select>
          </div>
        </div>

        {/* Menu Items Grid */}
        {loading ? (
          <div className="flex py-16 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-sm text-gray-500">
            No dishes match your dietary or category selection.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((dish) => (
              <div
                key={dish.id}
                onClick={() => setSelectedDish(dish)}
                className={`group cursor-pointer overflow-hidden rounded-2xl border transition duration-300 ${
                  dish.is_available
                    ? "border-gray-800 bg-gray-900 hover:border-amber-500/50 hover:shadow-2xl"
                    : "border-gray-850 bg-gray-950/60 opacity-75"
                }`}
              >
                {/* Dish Image Container */}
                <div className="relative h-48 w-full bg-gray-950 overflow-hidden flex items-center justify-center">
                  {dish.image_url ? (
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <span className="text-5xl opacity-80">🍲</span>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {dish.is_featured && (
                      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-gray-950 shadow">
                        ★ Chef Special
                      </span>
                    )}
                  </div>

                  {!dish.is_available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                      <span className="rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 shadow">
                        Currently Unavailable
                      </span>
                    </div>
                  )}
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                        {dish.category_name || "Specialty"}
                      </span>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition">
                        {dish.name}
                      </h3>
                    </div>
                    <span className="text-lg font-black text-emerald-400">₹{dish.price.toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-gray-400 line-clamp-2">
                    {dish.description || "Freshly prepared with authentic ingredients."}
                  </p>

                  {/* Dish Attributes */}
                  <div className="flex flex-wrap items-center justify-between border-t border-gray-800/80 pt-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1 text-gray-300">
                      ⏱️ {dish.preparation_time_minutes} mins prep
                    </span>

                    <div className="flex items-center gap-1.5">
                      {dish.spicy_level > 0 && (
                        <span className="text-red-400 font-semibold">🌶️ x{dish.spicy_level}</span>
                      )}
                      {dish.is_vegetarian && <span className="text-emerald-400 font-semibold">🌱 Veg</span>}
                      {dish.is_vegan && <span className="text-teal-400 font-semibold">🌿 Vegan</span>}
                      {dish.is_jain && <span className="text-orange-400 font-semibold">🪷 Jain</span>}
                    </div>
                  </div>

                  {/* Ordering Action Status */}
                  <button
                    type="button"
                    disabled={!dish.is_available}
                    className={`mt-2 w-full rounded-xl py-2.5 text-xs font-bold transition ${
                      dish.is_available
                        ? "bg-amber-500 text-gray-950 hover:bg-amber-400"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {dish.is_available ? "View Details" : "Currently Unavailable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DISH DETAIL MODAL */}
      {selectedDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl space-y-4">
            <div className="relative h-56 bg-gray-950 overflow-hidden flex items-center justify-center">
              {selectedDish.image_url ? (
                <img src={selectedDish.image_url} alt={selectedDish.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl">🍲</span>
              )}
              <button
                type="button"
                onClick={() => setSelectedDish(null)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-amber-400">{selectedDish.category_name}</span>
                  <h2 className="text-xl font-bold text-white">{selectedDish.name}</h2>
                </div>
                <span className="text-2xl font-black text-emerald-400">₹{selectedDish.price.toFixed(2)}</span>
              </div>

              <p className="text-sm text-gray-300">{selectedDish.description || "No description provided."}</p>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-950 p-4 text-xs text-gray-300 border border-gray-800">
                <div>
                  <span className="text-gray-500 block">Prep Time</span>
                  <span className="font-semibold text-white">⏱️ {selectedDish.preparation_time_minutes} minutes</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Spice Intensity</span>
                  <span className="font-semibold text-white">
                    {selectedDish.spicy_level > 0 ? `🌶️ ${selectedDish.spicy_level} / 5` : "Mild (0)"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {selectedDish.is_vegetarian && (
                  <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 ring-1 ring-emerald-500/20 font-semibold">
                    🌱 Vegetarian
                  </span>
                )}
                {selectedDish.is_vegan && (
                  <span className="rounded-lg bg-teal-500/10 px-3 py-1 text-xs text-teal-400 ring-1 ring-teal-500/20 font-semibold">
                    🌿 Vegan
                  </span>
                )}
                {selectedDish.is_jain && (
                  <span className="rounded-lg bg-orange-500/10 px-3 py-1 text-xs text-orange-400 ring-1 ring-orange-500/20 font-semibold">
                    🪷 Jain
                  </span>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!selectedDish.is_available}
                  className={`w-full rounded-xl py-3 text-sm font-bold transition ${
                    selectedDish.is_available
                      ? "bg-amber-500 text-gray-950 hover:bg-amber-400"
                      : "bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed"
                  }`}
                >
                  {selectedDish.is_available ? "Item Available (Ordering coming soon)" : "Currently Unavailable"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
