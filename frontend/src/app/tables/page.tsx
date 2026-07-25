"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRBAC } from "@/hooks/use-rbac";
import {
  fetchTableList,
  toggleTableStatus,
  deleteTable,
  DiningTable,
  TableStatusType,
} from "@/services/table";
import Link from "next/link";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

const STATUS_CONFIG: Record<
  TableStatusType,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  available: {
    label: "Available",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
  },
  reserved: {
    label: "Reserved",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
  },
  occupied: {
    label: "Occupied",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-400",
    borderClass: "border-blue-500/30",
  },
  billing: {
    label: "Billing",
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-400",
    borderClass: "border-purple-500/30",
  },
  cleaning: {
    label: "Cleaning",
    bgClass: "bg-teal-500/10",
    textClass: "text-teal-400",
    borderClass: "border-teal-500/30",
  },
  out_of_service: {
    label: "Out of Service",
    bgClass: "bg-slate-800",
    textClass: "text-slate-400",
    borderClass: "border-slate-700",
  },
};

export default function TableListPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const canManage = hasRole("admin", "manager");
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [capacityFilter, setCapacityFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Delete Modal State
  const [deletingTable, setDeletingTable] = useState<DiningTable | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch paginated tables list
  const {
    data: tableData,
    isLoading: isTablesLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["tables-list", search, statusFilter, capacityFilter, page],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return fetchTableList(token, {
        search: search || undefined,
        status: statusFilter || undefined,
        capacity: capacityFilter ? parseInt(capacityFilter, 10) : undefined,
        page,
        page_size: pageSize,
      });
    },
    enabled: !!isSignedIn,
  });

  // Toggle active / status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
      status,
    }: {
      id: string;
      is_active?: boolean;
      status?: TableStatusType;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return toggleTableStatus(token, id, { is_active, status });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["tables-list"] });
      setNotification({
        type: "success",
        text: `Table '${updated.table_number}' status updated to ${updated.status}.`,
      });
      setTimeout(() => setNotification(null), 4000);
    },
    onError: (err: Error) => {
      setNotification({
        type: "error",
        text: err.message || "Failed to update table status.",
      });
    },
  });

  // Delete table mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return deleteTable(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables-list"] });
      setDeletingTable(null);
      setNotification({
        type: "success",
        text: "Dining table deleted successfully.",
      });
      setTimeout(() => setNotification(null), 4000);
    },
    onError: (err: Error) => {
      setDeletingTable(null);
      setNotification({
        type: "error",
        text: err.message || "Failed to delete table.",
      });
    },
  });

  if (!isAuthLoaded || isRbacLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          Loading table layout...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
              <UtensilsCrossed className="w-7 h-7 text-orange-500" /> Table Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Overview of dining tables, capacity, and real-time operational status.
            </p>
          </div>

          {canManage && (
            <Link
              href="/tables/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Table
            </Link>
          )}
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            {notification.text}
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search by Table Number */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by table number (e.g. T-01)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="occupied">Occupied</option>
              <option value="billing">Billing</option>
              <option value="cleaning">Cleaning</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>

          {/* Capacity Filter */}
          <div className="sm:col-span-3">
            <select
              value={capacityFilter}
              onChange={(e) => {
                setCapacityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
            >
              <option value="">All Capacities</option>
              <option value="2">2 Seats</option>
              <option value="4">4 Seats</option>
              <option value="6">6 Seats</option>
              <option value="8">8 Seats</option>
              <option value="10">10+ Seats</option>
            </select>
          </div>
        </div>

        {/* Table List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {isTablesLoading ? (
            <div className="p-12 flex items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              Loading tables...
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-rose-400 space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto" />
              <p>Failed to load tables: {(error as Error).message}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : tableData?.items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-base font-medium text-slate-300">
                No dining tables found
              </p>
              <p className="text-xs text-slate-500">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Table Number</th>
                    <th className="py-3.5 px-4">Capacity</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Active State</th>
                    {canManage && <th className="py-3.5 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {tableData?.items.map((t) => {
                    const statusMeta =
                      STATUS_CONFIG[t.status as TableStatusType] ||
                      STATUS_CONFIG.available;

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        {/* Table Number */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {t.table_number.substring(0, 3)}
                            </div>
                            <span className="font-bold text-slate-100">
                              {t.table_number}
                            </span>
                          </div>
                        </td>

                        {/* Capacity */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {t.capacity} {t.capacity === 1 ? "Seat" : "Seats"}
                          </div>
                        </td>

                        {/* Current Status */}
                        <td className="py-3.5 px-4">
                          {canManage ? (
                            <select
                              value={t.status}
                              onChange={(e) =>
                                toggleMutation.mutate({
                                  id: t.id,
                                  status: e.target.value as TableStatusType,
                                })
                              }
                              disabled={toggleMutation.isPending}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass} focus:outline-none`}
                            >
                              <option value="available">Available</option>
                              <option value="reserved">Reserved</option>
                              <option value="occupied">Occupied</option>
                              <option value="billing">Billing</option>
                              <option value="cleaning">Cleaning</option>
                              <option value="out_of_service">Out of Service</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {t.description || "—"}
                        </td>

                        {/* Active State */}
                        <td className="py-3.5 px-4">
                          {canManage ? (
                            <button
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: t.id,
                                  is_active: !t.is_active,
                                })
                              }
                              disabled={toggleMutation.isPending}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                t.is_active
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                              }`}
                            >
                              {t.is_active ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Enabled
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-slate-500" /> Disabled
                                </>
                              )}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                t.is_active
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-slate-800 border-slate-700 text-slate-400"
                              }`}
                            >
                              {t.is_active ? "Enabled" : "Disabled"}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        {canManage && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/tables/${t.id}/edit`}
                                className="p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="Edit Table"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => setDeletingTable(t)}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="Delete Table"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {tableData && tableData.total_pages > 1 && (
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing Page <strong>{tableData.page}</strong> of{" "}
                <strong>{tableData.total_pages}</strong> ({tableData.total} total tables)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(tableData.total_pages, p + 1))}
                  disabled={page >= tableData.total_pages}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTable && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Delete Table {deletingTable.table_number}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to soft-delete table{" "}
                <strong className="text-slate-200">
                  {deletingTable.table_number}
                </strong>{" "}
                ({deletingTable.capacity} Seats)? This will mark it as out of service and remove it from active layouts.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingTable(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingTable.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
