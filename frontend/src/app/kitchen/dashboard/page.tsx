"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import {
  acceptOrder,
  fetchKDSOrders,
  markOrderCompleted,
  markOrderReady,
  pauseOrder,
  resumeOrder,
  startPreparing,
  updatePrepTime,
  updatePriority,
} from "@/services/kds";
import { OrderOut } from "@/services/order";

function KitchenDashboardPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortBy, setSortBy] = useState<"oldest" | "newest" | "longest_waiting">("oldest");

  // Double click protection & modal state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);
  const [updatingTimeOrderId, setUpdatingTimeOrderId] = useState<string | null>(null);

  const isAuthorized =
    hasRole("kitchen", "kitchen_staff", "chef", "manager", "admin");
  const isManager = hasRole("manager") || hasRole("admin");

  const loadKDSData = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const data = await fetchKDSOrders(token, {
        search: search.trim() || undefined,
        status: statusFilter,
        sort_by: sortBy,
      });

      setOrders(data);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load KDS orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || !isAuthorized) return;

    loadKDSData();

    // 3-second live polling
    const interval = setInterval(() => {
      loadKDSData();
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading, isAuthorized, search, statusFilter, sortBy]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingOrderId) return;

    try {
      setActionLoading(acceptingOrderId);
      const token = await getToken();
      if (!token) return;

      await acceptOrder(token, acceptingOrderId, prepMinutes);
      setAcceptingOrderId(null);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to accept order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await startPreparing(token, orderId);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to start preparation.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await markOrderReady(token, orderId);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to mark order ready.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkCompleted = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await markOrderCompleted(token, orderId);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to complete order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (orderId: string) => {
    const reason = prompt("Enter reason for pausing preparation (optional):");
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await pauseOrder(token, orderId, reason || undefined);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to pause order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await resumeOrder(token, orderId);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to resume order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePriority = async (orderId: string, priority: "normal" | "high" | "urgent") => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      await updatePriority(token, orderId, priority);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to update priority.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePrepTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingTimeOrderId) return;

    try {
      setActionLoading(updatingTimeOrderId);
      const token = await getToken();
      if (!token) return;

      await updatePrepTime(token, updatingTimeOrderId, prepMinutes);
      setUpdatingTimeOrderId(null);
      await loadKDSData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to update prep time.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Kitchen Display System (KDS)...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">🍳</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Kitchen Access Only</h2>
          <p className="mt-1 text-sm text-gray-400">
            Only Kitchen Staff and Managers are authorized to access the KDS dashboard.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const preparingCount = orders.filter((o) => o.status === "preparing" || o.status === "accepted").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top KDS Bar with Flame Amber & Warm Orange Theme */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-5 backdrop-blur-xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl shadow ring-1 ring-amber-500/30">🍳</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white tracking-tight">Kitchen Display System</h1>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300 ring-1 ring-amber-500/40">
                    KDS Station
                  </span>
                </div>
                <p className="text-xs text-amber-200/70">Real-time dish preparation, timing estimates, and station workflow</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-bold">
            <div className="flex-1 sm:flex-none text-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-300 shadow">
              Pending: {pendingCount}
            </div>
            <div className="flex-1 sm:flex-none text-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-300 shadow">
              Preparing: {preparingCount}
            </div>
            <div className="flex-1 sm:flex-none text-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-300 shadow">
              Ready: {readyCount}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Toolbar: Search, Status Tabs & Sorting */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search Order Number..."
            className="w-full md:w-72 rounded-xl bg-gray-950 px-4 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />

          <div className="flex overflow-x-auto gap-2 no-scrollbar">
            {[
              { label: "All Active", value: "active" },
              { label: "Pending", value: "pending" },
              { label: "Accepted", value: "accepted" },
              { label: "Preparing", value: "preparing" },
              { label: "Ready", value: "ready" },
              { label: "Paused", value: "paused" },
            ].map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`whitespace-nowrap capitalize rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  statusFilter === value
                    ? value === "completed"
                      ? "bg-emerald-700 text-white"
                      : "bg-amber-500 text-gray-950"
                    : "bg-gray-950 text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "oldest" | "newest" | "longest_waiting")}
            className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none"
          >
            <option value="oldest">Sort: Oldest Order (FIFO)</option>
            <option value="newest">Sort: Newest Order</option>
            <option value="longest_waiting">Sort: Longest Waiting</option>
          </select>
        </div>

        {/* Active Order Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {orders.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-sm text-gray-500">
              No active kitchen orders. Standby for incoming customer orders!
            </div>
          ) : (
            orders.map((ord) => {
              const isActionDisabled = actionLoading === ord.id;

              const isDone = ["completed", "served", "cancelled"].includes(ord.status);

              return (
                <div
                  key={ord.id}
                  className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition shadow-xl ${
                    isDone
                      ? "border-gray-700/50 bg-gray-950/60 opacity-70"
                      : ord.is_delayed
                      ? "border-red-500/50 bg-red-950/20 ring-1 ring-red-500/40"
                      : ord.status === "pending"
                      ? "border-amber-500/40 bg-gray-900"
                      : ord.status === "ready"
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <div>
                    {/* Delayed Warning Banner */}
                    {ord.is_delayed && (
                      <div className="bg-red-500/20 px-4 py-2 border-b border-red-500/30 text-center text-xs font-black text-red-400 animate-pulse">
                        ⚠️ DELAYED — Exceeded Estimated Preparation Time
                      </div>
                    )}

                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-5 py-3">
                      <div>
                        <span className="font-mono text-sm font-bold text-amber-400">{ord.order_number}</span>
                        <p className="text-[11px] text-gray-400">
                          Table {ord.table_number || "Walk-in"} • {ord.guest_count || 1} Guests
                        </p>
                      </div>

                      {/* Priority Badge */}
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ring-1 ${
                            ord.priority === "urgent"
                              ? "bg-red-500/20 text-red-300 ring-red-500/40 animate-pulse"
                              : ord.priority === "high"
                              ? "bg-orange-500/20 text-orange-300 ring-orange-500/40"
                              : "bg-gray-800 text-gray-400 ring-gray-700"
                          }`}
                        >
                          {ord.priority}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          ⏱️ Elapsed: {formatElapsed(ord.elapsed_seconds ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Order Details & Items */}
                    <div className="p-5 space-y-4">
                      {ord.estimated_prep_minutes && (
                        <div className="flex items-center justify-between text-xs rounded-xl bg-gray-950 p-2.5 border border-gray-800">
                          <span className="text-gray-400">Est. Prep Time:</span>
                          <span className="font-bold text-emerald-400">{ord.estimated_prep_minutes} minutes</span>
                        </div>
                      )}

                      {/* Itemized List */}
                      <div className="space-y-3 divide-y divide-gray-800/60">
                        {ord.items.map((item) => (
                          <div key={item.id} className="pt-2 text-xs">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-white">
                                <span className="text-amber-400 text-sm">{item.quantity}x</span> {item.menu_item_name}
                              </span>
                            </div>
                            {item.special_instructions && (
                              <p className="mt-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 border border-amber-500/20">
                                📝 {item.special_instructions}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {ord.notes && (
                        <p className="text-xs italic text-gray-400 border-t border-gray-800 pt-2">
                          Notes: {ord.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* KDS Action Buttons */}
                  <div className="space-y-2 border-t border-gray-800 bg-gray-950 p-4">
                    {ord.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptingOrderId(ord.id);
                          setPrepMinutes(15);
                        }}
                        disabled={isActionDisabled}
                        className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
                      >
                        Accept Order & Set Prep Time
                      </button>
                    )}

                    {ord.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() => handleStartPreparing(ord.id)}
                        disabled={isActionDisabled}
                        className="w-full rounded-xl bg-blue-500 py-3 text-xs font-bold text-white hover:bg-blue-400 transition"
                      >
                        ▶️ Start Preparing
                      </button>
                    )}

                    {ord.status === "preparing" && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkReady(ord.id)}
                          disabled={isActionDisabled}
                          className="rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-gray-950 hover:bg-emerald-400 transition col-span-2"
                        >
                          🔔 Mark Order Ready
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePause(ord.id)}
                          disabled={isActionDisabled}
                          className="rounded-xl bg-gray-800 py-2 text-[11px] font-semibold text-gray-300 hover:bg-gray-700 transition"
                        >
                          ⏸️ Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUpdatingTimeOrderId(ord.id);
                            setPrepMinutes(ord.estimated_prep_minutes || 15);
                          }}
                          disabled={isActionDisabled}
                          className="rounded-xl bg-gray-800 py-2 text-[11px] font-semibold text-gray-300 hover:bg-gray-700 transition"
                        >
                          ⏱️ Edit Time
                        </button>
                      </div>
                    )}

                    {ord.status === "ready" && (
                      <button
                        type="button"
                        onClick={() => handleMarkCompleted(ord.id)}
                        disabled={isActionDisabled}
                        className="w-full rounded-xl bg-purple-600 py-3 text-xs font-bold text-white hover:bg-purple-500 transition"
                      >
                        ✓ Mark Served & Completed
                      </button>
                    )}

                    {ord.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => handleResume(ord.id)}
                        disabled={isActionDisabled}
                        className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
                      >
                        ▶️ Resume Order
                      </button>
                    )}

                    {/* Manager Priority Control — only for in-flight orders */}
                    {isManager && !isDone && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-[10px]">
                        <span className="text-gray-400 font-semibold">Priority:</span>
                        <select
                          value={ord.priority}
                          onChange={(e) =>
                            handleUpdatePriority(ord.id, e.target.value as "normal" | "high" | "urgent")
                          }
                          className="rounded-lg bg-gray-900 px-2 py-1 text-white border border-gray-700 focus:outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    )}

                    {/* Completed / Served / Cancelled badge */}
                    {isDone && (
                      <div className={`rounded-xl py-2 text-center text-xs font-bold ${
                        ord.status === "cancelled"
                          ? "bg-red-900/30 text-red-400"
                          : "bg-emerald-900/30 text-emerald-400"
                      }`}>
                        {ord.status === "cancelled" ? "❌ Cancelled" : ord.status === "served" ? "✅ Served" : "✅ Completed"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ACCEPT ORDER MODAL */}
      {acceptingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAccept}
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Accept Order & Estimate Prep Time</h3>
            <p className="text-xs text-gray-400">
              Enter estimated preparation time in minutes. Customer will be notified instantly.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-300">Estimated Minutes</label>
              <input
                type="number"
                min={1}
                max={180}
                required
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(parseInt(e.target.value) || 15)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAcceptingOrderId(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400"
              >
                Accept Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT PREP TIME MODAL */}
      {updatingTimeOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpdatePrepTimeSubmit}
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Adjust Estimated Prep Time</h3>
            <p className="text-xs text-gray-400">
              Update preparation time. Changes will reflect instantly on customer and waiter screens.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-300">Updated Minutes</label>
              <input
                type="number"
                min={1}
                max={180}
                required
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(parseInt(e.target.value) || 15)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUpdatingTimeOrderId(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400"
              >
                Save Prep Time
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function KitchenDashboardWrapper() {
  return (
    <RouteGuard roles={["kitchen", "kitchen_staff", "chef", "manager", "admin"]}>
      <KitchenDashboardPage />
    </RouteGuard>
  );
}
