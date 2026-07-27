"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";

import { useToast } from "@/context/ToastContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CleaningTable {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
  location_description: string | null;
}

async function fetchCleaningTables(token: string): Promise<CleaningTable[]> {
  const res = await fetch(`${API}/api/v1/tables/cleaning-queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch cleaning queue.");
  return res.json();
}

async function markTableClean(token: string, tableId: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/tables/${tableId}/mark-clean`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to mark table as clean.");
  }
}

function CleaningDashboardPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();
  const toast = useToast();

  const [tables, setTables] = useState<CleaningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const isAuthorized =
    hasRole("cleaning_staff", "cleaner", "housekeeping", "manager", "admin");

  const loadTables = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchCleaningTables(token);
      setTables(data);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load cleaning queue.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoading || !isAuthorized) return;
    Promise.resolve().then(() => loadTables());
    const interval = setInterval(loadTables, 3000);
    return () => clearInterval(interval);
  }, [isLoading, isAuthorized, loadTables]);

  const handleMarkClean = async (tableId: string, tableNumber: string) => {
    try {
      setActionLoading(tableId);
      setErrorMsg(null);
      const token = await getToken();
      if (!token) return;
      await markTableClean(token, tableId);
      setCompletedIds((prev) => new Set([...prev, tableId]));
      const msg = `Table ${tableNumber} marked clean & ready!`;
      setSuccessMsg(msg);
      toast.success(msg, "Table Cleaned");
      await loadTables();
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to mark table clean.";
      setErrorMsg(msg);
      toast.error(msg, "Housekeeping Error");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Cleaning Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">🚫</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Access Restricted</h2>
          <p className="mt-1 text-sm text-gray-400">
            Only Cleaning Staff, Managers, and Admins can access this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = tables.filter((t) => !completedIds.has(t.id)).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header with Fresh Cyan & Aqua Theme */}
      <header className="border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent px-4 sm:px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-xl font-extrabold text-cyan-300 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/10">
              🧹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-tight">
                  Housekeeping & Table Hygiene Queue
                </h1>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-300 ring-1 ring-cyan-500/40">
                  Cleaning Station
                </span>
              </div>
              <p className="text-xs text-cyan-200/70">
                Tables pending cleaning after bill payment settlement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live (5s)
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-gray-950">
                {pendingCount} Pending
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
            ✅ {successMsg}
          </div>
        )}

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-16 text-center">
            <span className="text-5xl">✨</span>
            <p className="mt-4 text-lg font-bold text-gray-300">All Tables Clean!</p>
            <p className="mt-1 text-sm text-gray-500">
              No tables pending cleaning right now. Great work!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => {
              const isDone = completedIds.has(table.id);
              return (
                <div
                  key={table.id}
                  className={`rounded-2xl border p-5 space-y-4 transition ${
                    isDone
                      ? "border-emerald-500/30 bg-emerald-950/20 opacity-60"
                      : "border-yellow-500/30 bg-gray-900"
                  }`}
                >
                  {/* Table Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                        Needs Cleaning
                      </p>
                      <p className="text-3xl font-black text-white mt-0.5">
                        {table.table_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Capacity</p>
                      <p className="text-lg font-bold text-amber-400">
                        {table.capacity} seats
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  {table.location_description && (
                    <p className="text-xs text-gray-400">
                      📍 {table.location_description}
                    </p>
                  )}

                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${
                        isDone
                          ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30"
                          : "bg-yellow-500/20 text-yellow-300 ring-yellow-500/30 animate-pulse"
                      }`}
                    >
                      {isDone ? "✓ Cleaned" : "🧹 Cleaning Required"}
                    </span>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => handleMarkClean(table.id, table.table_number)}
                    disabled={actionLoading === table.id || isDone}
                    className={`w-full py-3 rounded-xl text-xs font-extrabold transition ${
                      isDone
                        ? "bg-emerald-900/40 text-emerald-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    }`}
                  >
                    {actionLoading === table.id
                      ? "Updating..."
                      : isDone
                      ? "✓ Marked Clean"
                      : "✅ Mark as Clean"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {tables.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between text-xs text-gray-400">
            <span>Total tables in queue: <strong className="text-white">{tables.length}</strong></span>
            <span>Cleaned this session: <strong className="text-emerald-400">{completedIds.size}</strong></span>
            <span>Still pending: <strong className="text-amber-400">{pendingCount}</strong></span>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CleaningDashboardWrapper() {
  return (
    <RouteGuard roles={["cleaning_staff", "cleaner", "housekeeping", "manager", "admin"]}>
      <CleaningDashboardPage />
    </RouteGuard>
  );
}
