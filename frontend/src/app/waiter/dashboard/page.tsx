"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import {
  DiningTable,
  fetchPendingVerifications,
  fetchTableList,
  PendingVerificationTable,
  verifyCustomerArrival,
} from "@/services/table";

export default function WaiterDashboardPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const [loading, setLoading] = useState<boolean>(true);
  const [verifications, setVerifications] = useState<PendingVerificationTable[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject modal state
  const [rejectingTableId, setRejectingTableId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const isStaffAuthorized = hasRole("waiter") || hasRole("manager") || hasRole("admin");

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [pendingRes, tableListRes] = await Promise.all([
        fetchPendingVerifications(token),
        fetchTableList(token, { page_size: 100 }),
      ]);

      setVerifications(pendingRes);
      setTables(tableListRes.items);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load waiter dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || !isStaffAuthorized) return;

    loadData();

    // Live Polling every 3 seconds for instant updates
    const interval = setInterval(() => {
      loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading, isStaffAuthorized]);

  const handleConfirmArrival = async (tableId: string) => {
    try {
      setActionLoading(tableId);
      const token = await getToken();
      if (!token) return;

      await verifyCustomerArrival(token, tableId, "confirm");
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to confirm arrival.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectArrival = async () => {
    if (!rejectingTableId) return;

    try {
      setActionLoading(rejectingTableId);
      const token = await getToken();
      if (!token) return;

      await verifyCustomerArrival(
        token,
        rejectingTableId,
        "reject",
        rejectReason.trim() || undefined
      );

      setRejectingTableId(null);
      setRejectReason("");
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to reject arrival.");
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
          <p className="text-sm text-gray-400">Loading Waiter Verification Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isStaffAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Access Restricted</h2>
          <p className="mt-1 text-sm text-gray-400">
            You must be logged in with Waiter, Manager, or Admin role to access the Waiter Verification Dashboard.
          </p>
        </div>
      </div>
    );
  }

  const filteredTables = tables.filter((t) => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header Bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-xl font-bold text-amber-400 ring-1 ring-amber-500/20">
              🛎️
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Waiter Verification & Live Table Matrix</h1>
              <p className="text-xs text-gray-400">Real-time arrival verification and floor status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Polling (3s)
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* SECTION 1: PENDING VERIFICATION REQUESTS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📍 Arrival Verification Requests</span>
                {verifications.length > 0 && (
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-gray-950 animate-bounce">
                    {verifications.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">Guests who pressed &quot;I&apos;m at my table&quot;</p>
            </div>
          </div>

          {verifications.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center">
              <span className="text-3xl">✨</span>
              <p className="mt-2 text-sm font-semibold text-gray-300">No Pending Verification Requests</p>
              <p className="text-xs text-gray-500">All guest arrivals are verified.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {verifications.map((item) => (
                <div
                  key={item.table_id}
                  className="rounded-2xl border border-amber-500/30 bg-gray-900 p-5 shadow-xl transition hover:border-amber-500/50"
                >
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Awaiting Verification</span>
                    <span className="font-mono text-xs text-gray-400">{formatElapsed(item.time_elapsed_seconds)} ago</span>
                  </div>

                  <div className="my-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Table Number</p>
                      <p className="text-3xl font-black text-white">{item.table_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Group Size</p>
                      <p className="text-lg font-bold text-amber-400">{item.guest_count} Guests</p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl bg-gray-950 p-3 text-xs text-gray-300">
                    Guest: <span className="font-semibold text-white">{item.guest_name || "Walk-in Guest"}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmArrival(item.table_id)}
                      disabled={actionLoading === item.table_id}
                      className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-gray-950 hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                      {actionLoading === item.table_id ? "Confirming..." : "✅ Confirm Arrival"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingTableId(item.table_id);
                        setRejectReason("");
                      }}
                      disabled={actionLoading === item.table_id}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: LIVE FLOOR TABLE MATRIX */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">🪑 Live Floor Table Matrix</h2>
              <p className="text-xs text-gray-400">Overview of all physical tables and current operational status</p>
            </div>
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-gray-900 p-1.5 text-xs font-medium">
              {["all", "available", "reserved", "awaiting_verification", "occupied", "cleaning", "out_of_service"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition ${
                    filterStatus === st ? "bg-amber-500 font-bold text-gray-950" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {st.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredTables.map((tbl) => {
              const statusColor =
                tbl.status === "available"
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                  : tbl.status === "reserved"
                  ? "border-blue-500/30 bg-blue-950/20 text-blue-400"
                  : tbl.status === "awaiting_verification"
                  ? "border-amber-500/50 bg-amber-950/30 text-amber-300 animate-pulse"
                  : tbl.status === "occupied"
                  ? "border-purple-500/30 bg-purple-950/20 text-purple-400"
                  : tbl.status === "cleaning"
                  ? "border-yellow-500/30 bg-yellow-950/20 text-yellow-400"
                  : "border-gray-700 bg-gray-900 text-gray-500";

              return (
                <div
                  key={tbl.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 backdrop-blur ${statusColor}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">{tbl.table_number}</span>
                    <span className="text-[10px] opacity-75">{tbl.capacity} Seats</span>
                  </div>
                  <div className="mt-3">
                    <span className="block text-xs font-extrabold capitalize">{tbl.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* REJECT REASON MODAL */}
      {rejectingTableId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Reject Arrival Verification</h3>
            <p className="text-xs text-gray-400">
              Provide an optional reason to explain why the guest arrival was rejected.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Table unoccupied / Guest not seated"
              rows={3}
              className="w-full rounded-xl bg-gray-950 p-3 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingTableId(null)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectArrival}
                disabled={Boolean(actionLoading)}
                className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400 transition disabled:opacity-50"
              >
                Reject Arrival
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
