"use client";

import { RouteGuard } from "@/components/RouteGuard";
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

import Link from "next/link";
import { clearAllNotifications, dismissNotification, fetchWaiterNotifications, generateBill, WaiterNotification } from "@/services/billing";
import { toggleTableStatus, TableStatusType } from "@/services/table";
import { fetchKDSOrders, fetchWaiterOrders } from "@/services/kds";
import { OrderOut } from "@/services/order";

function WaiterDashboardPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const [loading, setLoading] = useState<boolean>(true);
  const [verifications, setVerifications] = useState<PendingVerificationTable[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderOut[]>([]);
  const [notifications, setNotifications] = useState<WaiterNotification[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Discount & Tip state for bill generation
  const [discountAmt, setDiscountAmt] = useState<number>(0);
  const [tipAmt, setTipAmt] = useState<number>(0);
  const [generatedBillId, setGeneratedBillId] = useState<string | null>(null);
  const [billedOrderIds, setBilledOrderIds] = useState<Set<string>>(new Set());

  // Table edit modal state
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [editStatus, setEditStatus] = useState<TableStatusType>("available");
  const [isSavingTable, setIsSavingTable] = useState(false);

  // Reject modal state
  const [rejectingTableId, setRejectingTableId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const isStaffAuthorized = hasRole("waiter") || hasRole("manager") || hasRole("admin");

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [pendingRes, tableListRes, notifsRes, ordersRes] = await Promise.allSettled([
        fetchPendingVerifications(token),
        fetchTableList(token, { page_size: 100 }),
        fetchWaiterNotifications(token),
        fetchWaiterOrders(token),
      ]);

      if (pendingRes.status === "fulfilled") setVerifications(pendingRes.value);
      if (tableListRes.status === "fulfilled") setTables(tableListRes.value.items);
      if (notifsRes.status === "fulfilled") setNotifications(notifsRes.value);
      if (ordersRes.status === "fulfilled") setActiveOrders(ordersRes.value);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load waiter dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    const token = await getToken();
    if (!token) return;
    await dismissNotification(token, notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const handleClearAllNotifications = async () => {
    const token = await getToken();
    if (!token) return;
    await clearAllNotifications(token);
    setNotifications([]);
  };

  const handleOpenEditTable = (tbl: DiningTable) => {
    setEditingTable(tbl);
    setEditStatus(tbl.status as TableStatusType);
    setErrorMsg(null);
  };

  const handleSaveTableStatus = async () => {
    if (!editingTable) return;
    try {
      setIsSavingTable(true);
      const token = await getToken();
      if (!token) return;
      await toggleTableStatus(token, editingTable.id, { status: editStatus });
      setSuccessMsg(`Table ${editingTable.table_number} updated to "${editStatus.replace(/_/g, " ")}".`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setEditingTable(null);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to update table status.");
    } finally {
      setIsSavingTable(false);
    }
  };

  const handleGenerateBill = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const token = await getToken();
      if (!token) return;

      const bill = await generateBill(token, orderId, discountAmt, tipAmt);
      setGeneratedBillId(bill.id);
      setBilledOrderIds((prev) => new Set([...prev, orderId]));
      setSuccessMsg(`Bill ${bill.bill_number} generated successfully! Session locked for Table ${bill.table_number || ''}.`);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to generate bill.");
    } finally {
      setActionLoading(null);
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

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
            ✅ {successMsg}
          </div>
        )}

        {/* REAL-TIME NOTIFICATIONS & BILL REQUESTS SECTION */}
        {notifications.length > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <span>🔔 Real-Time Notifications & Bill Requests</span>
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-gray-950">
                  {notifications.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={handleClearAllNotifications}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
              >
                ✓ Clear All
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notifications.map((n) => (
                <div key={n.id} className="bg-gray-900 border border-amber-500/20 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">{n.title}</span>
                    <button
                      type="button"
                      onClick={() => handleDismissNotification(n.id)}
                      className="text-gray-500 hover:text-white transition text-base leading-none"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-300">{n.message}</p>
                </div>
              ))}
            </div>
          </section>
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
                  onClick={() => handleOpenEditTable(tbl)}
                  className={`flex flex-col justify-between rounded-xl border p-4 backdrop-blur cursor-pointer hover:ring-2 hover:ring-amber-500/40 transition ${statusColor}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">{tbl.table_number}</span>
                    <span className="text-[10px] opacity-75">{tbl.capacity} Seats</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="block text-xs font-extrabold capitalize">{tbl.status.replace(/_/g, " ")}</span>
                    <span className="text-[10px] opacity-50">✏️</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: ACTIVE TABLE ORDERS & BILL GENERATION (TABLE-WISE CONSOLIDATION) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">🧾 Table Billing & Final Bill Generation</h2>
              <p className="text-xs text-gray-400">Consolidated table-wise bill generation for seated dining sessions</p>
            </div>
            {generatedBillId && (
              <Link
                href={`/billing/${generatedBillId}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20"
              >
                💳 Open Generated Bill
              </Link>
            )}
          </div>

          {(() => {
            const tableGroupsMap = new Map<string, {
              table_number: string;
              primary_order_id: string;
              orders: typeof activeOrders;
              total_items: number;
              total_amount: number;
              all_order_numbers: string[];
              is_billed: boolean;
              has_in_progress: boolean;
            }>();

            for (const ord of activeOrders) {
              if (ord.status === "cancelled") continue;
              const key = ord.table_number || ord.table_id || ord.id;
              if (!tableGroupsMap.has(key)) {
                tableGroupsMap.set(key, {
                  table_number: ord.table_number || "N/A",
                  primary_order_id: ord.id,
                  orders: [],
                  total_items: 0,
                  total_amount: 0,
                  all_order_numbers: [],
                  is_billed: false,
                  has_in_progress: false,
                });
              }
              const grp = tableGroupsMap.get(key)!;
              grp.orders.push(ord);
              grp.total_items += ord.items.length;
              grp.total_amount += ord.final_amount;
              grp.all_order_numbers.push(`#${ord.order_number.slice(-6)}`);

              if (billedOrderIds.has(ord.id)) {
                grp.is_billed = true;
              }
              if (["pending", "accepted", "preparing", "paused"].includes(ord.status)) {
                grp.has_in_progress = true;
              }
            }

            const groups = Array.from(tableGroupsMap.values());

            if (groups.length === 0) {
              return (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 text-center text-xs text-gray-500">
                  No active table orders found to generate bill.
                </div>
              );
            }

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((grp) => (
                  <div key={grp.table_number} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wide">
                        Table {grp.table_number}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                        {grp.orders.length} {grp.orders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      <p className="font-semibold text-white">
                        Orders: <span className="text-amber-300">{grp.all_order_numbers.join(", ")}</span>
                      </p>
                      <p className="text-slate-400">
                        {grp.total_items} Items Total | Combined: <strong className="text-emerald-400">₹{grp.total_amount.toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-500 block">Discount (₹):</label>
                        <input
                          type="number"
                          min="0"
                          value={discountAmt}
                          onChange={(e) => setDiscountAmt(parseFloat(e.target.value) || 0)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block">Tip (₹):</label>
                        <input
                          type="number"
                          min="0"
                          value={tipAmt}
                          onChange={(e) => setTipAmt(parseFloat(e.target.value) || 0)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateBill(grp.primary_order_id)}
                      disabled={actionLoading === grp.primary_order_id || grp.is_billed || grp.has_in_progress}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-xl text-xs transition disabled:opacity-50"
                    >
                      {actionLoading === grp.primary_order_id
                        ? "Generating Consolidated Bill..."
                        : grp.is_billed
                        ? "✓ Table Bill Generated"
                        : grp.has_in_progress
                        ? "Kitchen Preparation In Progress"
                        : `🧾 Generate Bill for Table ${grp.table_number}`}
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      </main>

      {/* TABLE EDIT MODAL */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Edit Table {editingTable.table_number}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editingTable.capacity} seats · Current: <span className="text-amber-400 font-semibold capitalize">{editingTable.status.replace(/_/g, " ")}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="text-gray-500 hover:text-white text-lg leading-none transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 block">Set Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(["available", "occupied", "reserved", "cleaning", "out_of_service"] as TableStatusType[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={`rounded-xl px-3 py-2.5 text-xs font-semibold capitalize transition ${
                      editStatus === s
                        ? s === "available" ? "bg-emerald-600 text-white"
                          : s === "occupied" ? "bg-purple-600 text-white"
                          : s === "reserved" ? "bg-blue-600 text-white"
                          : s === "cleaning" ? "bg-yellow-600 text-gray-950"
                          : "bg-gray-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="flex-1 rounded-xl bg-gray-800 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTableStatus}
                disabled={isSavingTable || editStatus === editingTable.status}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-extrabold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                {isSavingTable ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

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

export default function WaiterDashboardWrapper() {
  return (
    <RouteGuard roles={["waiter", "manager", "admin"]}>
      <WaiterDashboardPage />
    </RouteGuard>
  );
}
