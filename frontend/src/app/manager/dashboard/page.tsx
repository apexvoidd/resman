"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import { RouteGuard } from "@/components/RouteGuard";
import {
  broadcastManagerAnnouncement,
  bulkResetTables,
  fetchManagerOverview,
  fetchRecipeProfitability,
  ManagerOverview,
  RecipeProfitabilityItem,
} from "@/services/manager";
import Link from "next/link";

export default function ManagerDashboardPage() {
  const { getToken } = useAuth();
  const { isLoading: rbacLoading, hasRole } = useRBAC();

  const isAuthorized = hasRole("manager") || hasRole("admin");

  const [activeTab, setActiveTab] = useState<"kpis" | "recipes">("kpis");
  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [recipes, setRecipes] = useState<RecipeProfitabilityItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>("");
  const [broadcastMsg, setBroadcastMsg] = useState<string>("");
  const [broadcastPriority, setBroadcastPriority] = useState<string>("urgent");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadManagerData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorMsg(null);
      const token = await getToken().catch(() => null);

      const [ovData, recData] = await Promise.all([
        fetchManagerOverview(token),
        fetchRecipeProfitability(token),
      ]);

      setOverview(ovData);
      setRecipes(recData);
    } catch (err: unknown) {
      console.error(err);
      if (!isSilent) setErrorMsg((err as Error).message || "Failed to load manager dashboard metrics.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!rbacLoading && isAuthorized) {
      Promise.resolve().then(() => loadManagerData(false));
      const interval = setInterval(() => {
        loadManagerData(true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [rbacLoading, isAuthorized, loadManagerData]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) {
      setErrorMsg("Please enter both title and message for the announcement.");
      return;
    }
    try {
      setActionLoading(true);
      const token = await getToken().catch(() => null);
      const res = await broadcastManagerAnnouncement(
        token,
        broadcastTitle,
        broadcastMsg,
        broadcastPriority
      );
      setSuccessMsg(res.message);
      setShowBroadcastModal(false);
      setBroadcastTitle("");
      setBroadcastMsg("");
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to send broadcast announcement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkResetTables = async () => {
    if (!confirm("Are you sure you want to reset all tables to AVAILABLE status?")) return;
    try {
      setActionLoading(true);
      const token = await getToken().catch(() => null);
      const res = await bulkResetTables(token);
      setSuccessMsg(res.message);
      loadManagerData();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to reset tables.");
    } finally {
      setActionLoading(false);
    }
  };

  if (rbacLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mb-3"></div>
        <p className="text-xs font-semibold">Authenticating Executive Session...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <RouteGuard roles={["manager", "admin"]}>
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-red-400">Access Restricted</h1>
          <p className="text-slate-400 mt-1 max-w-md text-xs">
            The Executive Hub is restricted to Managers and Administrators.
          </p>
          <Link
            href="/"
            className="mt-5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition"
          >
            Return to Main Dashboard
          </Link>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard roles={["manager", "admin"]}>
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Executive Header with Royal Indigo & Deep Purple Theme */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-transparent p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/10">
                👔
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Manager Executive Hub
                  </h1>
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-indigo-300 ring-1 ring-indigo-500/40">
                    Executive Control
                  </span>
                </div>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  Real-time Revenue KPIs, Recipe Margin Profiler, & Emergency Overrides
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => loadManagerData(false)}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
              >
                <span>🔄</span>
                <span>{loading ? "Syncing..." : "Refresh"}</span>
              </button>

              <button
                onClick={() => setShowBroadcastModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
              >
                <span>📢</span>
                <span>Broadcast Alert</span>
              </button>

              <button
                onClick={handleBulkResetTables}
                disabled={actionLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              >
                <span>🧹</span>
                <span>Reset Tables</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center justify-between">
              <span>⚠️ {errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 font-bold ml-4">
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center justify-between">
              <span>✅ {successMsg}</span>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 font-bold ml-4">
                ✕
              </button>
            </div>
          )}

          {/* KPI Dashboard Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Today&apos;s Revenue
                  </p>
                  <h3 className="text-2xl font-extrabold text-white mt-1">
                    ₹{overview?.today_revenue.toFixed(2) ?? "0.00"}
                  </h3>
                </div>
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
                  💵
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 flex items-center space-x-1">
                <span>Paid Bills:</span>
                <span className="font-semibold text-emerald-400">{overview?.paid_bills_count ?? 0}</span>
              </p>
            </div>

            {/* Active Orders */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Active Kitchen Orders
                  </p>
                  <h3 className="text-2xl font-extrabold text-sky-400 mt-1">
                    {overview?.active_orders_count ?? 0}
                  </h3>
                </div>
                <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-lg">
                  🍳
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                Total Orders Today: <span className="font-semibold text-slate-200">{overview?.total_orders_today ?? 0}</span>
              </p>
            </div>

            {/* Table Occupancy */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Table Occupancy
                  </p>
                  <h3 className="text-2xl font-extrabold text-indigo-400 mt-1">
                    {overview?.occupancy_rate ?? 0}%
                  </h3>
                </div>
                <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg">
                  🪑
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3">
                <div
                  className="bg-indigo-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(overview?.occupancy_rate ?? 0, 100)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Occupied: <span className="font-semibold text-slate-200">{overview?.occupied_tables ?? 0}</span> / {overview?.total_tables ?? 0} Tables
              </p>
            </div>

            {/* Stock & CSAT */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Stock Alerts & CSAT
                  </p>
                  <div className="flex items-center space-x-2.5 mt-1">
                    <span className="text-xl font-bold text-rose-400">
                      {overview?.low_stock_count ?? 0} <span className="text-[10px] text-slate-400 font-normal">Low Stock</span>
                    </span>
                    <span className="text-slate-700">|</span>
                    <span className="text-xl font-bold text-amber-400">
                      ⭐ {overview?.avg_csat ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                Today&apos;s Waste Cost: <span className="font-semibold text-rose-400">₹{overview?.today_waste_cost.toFixed(2) ?? "0.00"}</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 space-x-4">
            <button
              onClick={() => setActiveTab("kpis")}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === "kpis"
                  ? "border-sky-500 text-sky-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              📊 Sales & Operational Metrics
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === "recipes"
                  ? "border-sky-500 text-sky-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🍳 Recipe Food Cost & Margin Profiler ({recipes.length})
            </button>
          </div>

          {/* Tab 1: KPIs & Top Sales Breakdown */}
          {activeTab === "kpis" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>🔥</span>
                    <span>Top Selling Items Today</span>
                  </h3>
                  <Link href="/menu/items" className="text-xs text-sky-400 hover:underline">
                    View Menu
                  </Link>
                </div>

                {overview?.top_selling_items.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No orders registered yet today.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {overview?.top_selling_items.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200">{item.name}</span>
                          <span className="text-sky-400 font-semibold">
                            {item.quantity_sold} sold (₹{item.total_sales.toFixed(2)})
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className="bg-sky-500 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(
                                (item.quantity_sold /
                                  (overview.top_selling_items[0]?.quantity_sold || 1)) *
                                  100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager Quick Navigation & Staff Hub */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Executive Operations Hub</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/cashier"
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition group"
                  >
                    <span className="text-xl block mb-1">💵</span>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition">
                      Cashier POS
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Process cash/card settlements & receipts
                    </p>
                  </Link>

                  <Link
                    href="/recipes"
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition group"
                  >
                    <span className="text-xl block mb-1">📖</span>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition">
                      Recipe Management
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ingredient composition & stock links
                    </p>
                  </Link>

                  <Link
                    href="/staff"
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition group"
                  >
                    <span className="text-xl block mb-1">👥</span>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition">
                      Staff Directory
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Operational roles & permissions
                    </p>
                  </Link>

                  <Link
                    href="/inventory/dashboard"
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition group"
                  >
                    <span className="text-xl block mb-1">📦</span>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition">
                      Inventory Control
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ingredient stock & waste logs
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Recipe Profitability Analyzer */}
          {activeTab === "recipes" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>💡</span>
                    <span>Recipe Food Cost & Margin Profiler</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Raw ingredient food cost vs menu selling price. Target gross margin: 70%+
                  </p>
                </div>
                <Link
                  href="/recipes"
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition"
                >
                  + Manage Recipes
                </Link>
              </div>

              {recipes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <span className="text-3xl block">📖</span>
                  <p className="text-xs font-semibold">No recipes configured yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/60">
                        <th className="p-3">Menu Item</th>
                        <th className="p-3">Selling Price</th>
                        <th className="p-3">Recipe Cost</th>
                        <th className="p-3">Gross Profit</th>
                        <th className="p-3">Margin %</th>
                        <th className="p-3">70% Target Price</th>
                        <th className="p-3">Max Portions</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recipes.map((item) => {
                        const isHighMargin = item.margin_percent >= 70;
                        const isMedMargin = item.margin_percent >= 50 && item.margin_percent < 70;
                        return (
                          <tr key={item.recipe_id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3 font-semibold text-white">{item.menu_item_name}</td>
                            <td className="p-3 font-semibold text-emerald-400">
                              ₹{item.selling_price.toFixed(2)}
                            </td>
                            <td className="p-3 font-semibold text-rose-400">
                              ₹{item.recipe_cost.toFixed(2)}
                            </td>
                            <td className="p-3 font-semibold text-slate-200">
                              ₹{item.gross_profit.toFixed(2)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  isHighMargin
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : isMedMargin
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {item.margin_percent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-slate-400">
                              ₹{item.suggested_price_for_70pct_margin.toFixed(2)}
                            </td>
                            <td className="p-3 font-semibold text-sky-400">
                              {item.max_makeable_portions} portions
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                  item.is_available
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                {item.is_available ? "In Stock" : "Out of Stock"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Broadcast Modal */}
          {showBroadcastModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>📢</span>
                    <span>Send Staff Broadcast Alert</span>
                  </h3>
                  <button
                    onClick={() => setShowBroadcastModal(false)}
                    className="text-slate-400 hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Announcement Title
                    </label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="e.g. Rush Hour Alert / Specials Sold Out"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Message Content
                    </label>
                    <textarea
                      rows={3}
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      placeholder="Enter urgent instructions for Kitchen, Waiter, or Cleaning staff..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Priority Level
                    </label>
                    <select
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                    >
                      <option value="urgent">🔴 Urgent Alert</option>
                      <option value="high">🟠 High Priority</option>
                      <option value="normal">🔵 Normal Update</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowBroadcastModal(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
                    >
                      {actionLoading ? "Sending..." : "Send Announcement"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
