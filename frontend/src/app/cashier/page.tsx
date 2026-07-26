"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import { RouteGuard } from "@/components/RouteGuard";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BillItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  subtotal?: number;
}

interface Bill {
  id: string;
  bill_number: string;
  order_id: string;
  table_number?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  tip_amount: number;
  grand_total: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded";
  created_at: string;
  items: BillItem[];
}

function CashierPOSPage() {
  const { getToken } = useAuth();
  const { isLoading: rbacLoading, hasRole } = useRBAC();

  const isAuthorized =
    hasRole("cashier") || hasRole("waiter") || hasRole("manager") || hasRole("admin");

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Settlement Modal State
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi">("cash");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadBills = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const token = await getToken().catch(() => null);

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/v1/billing/bills`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? "Failed to fetch bills.");
      }
      const data = await res.json();
      setBills(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load billing records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rbacLoading && isAuthorized) {
      loadBills();
      const interval = setInterval(() => {
        loadBills();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [rbacLoading, isAuthorized]);

  const handleOpenSettlement = (bill: Bill) => {
    setSelectedBill(bill);
    setCashTendered(bill.grand_total);
    setPaymentMethod("cash");
    setNotes("");
  };

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    if (paymentMethod === "cash" && cashTendered < selectedBill.grand_total) {
      setErrorMsg(`Cash tendered (₹${cashTendered}) cannot be less than grand total (₹${selectedBill.grand_total}).`);
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);
      const token = await getToken().catch(() => null);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = {
        bill_id: selectedBill.id,
        amount: selectedBill.grand_total,
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === "cash" ? cashTendered : undefined,
        change_returned: paymentMethod === "cash" ? Math.max(0, cashTendered - selectedBill.grand_total) : undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch(`${API}/api/v1/billing/cash/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? "Failed to record settlement.");
      }

      setSuccessMsg(`Payment settled successfully for Bill #${selectedBill.bill_number}!`);
      setSelectedBill(null);
      loadBills();
    } catch (err: any) {
      setErrorMsg(err.message || "Settlement failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintInvoice = (billId: string) => {
    window.open(`${API}/api/v1/billing/invoices/${billId}/html`, "_blank");
  };

  const filteredBills = bills.filter((b) => {
    const matchesFilter = filterStatus === "all" || b.status === filterStatus;
    const matchesSearch =
      b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.table_number && b.table_number.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const changeReturn = selectedBill ? Math.max(0, cashTendered - selectedBill.grand_total) : 0;

  return (
    <RouteGuard roles={["cashier", "waiter", "manager", "admin"]}>
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 gap-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xl">
                💵
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Cashier POS Terminal
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Process Cash, Card & UPI Settlements, Calculate Cash Change, & Issue Receipts
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadBills}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
              >
                <span>🔄</span>
                <span>{loading ? "Syncing..." : "Refresh Bills"}</span>
              </button>
              <Link
                href="/manager/dashboard"
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
              >
                👔 Manager Hub
              </Link>
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

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === "all"
                    ? "bg-slate-800 text-white border border-slate-700 font-bold"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                All ({bills.length})
              </button>
              <button
                onClick={() => setFilterStatus("unpaid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === "unpaid"
                    ? "bg-rose-600 text-white font-bold"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                Unpaid ({bills.filter((b) => b.status === "unpaid").length})
              </button>
              <button
                onClick={() => setFilterStatus("paid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === "paid"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                Paid ({bills.filter((b) => b.status === "paid").length})
              </button>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search Table or Bill #"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Bills Grid */}
          {filteredBills.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <span className="text-3xl block">🧾</span>
              <p className="text-xs font-semibold">No bills found.</p>
              <p className="text-[11px] text-slate-600">
                New bills will appear automatically when orders are generated at dining tables.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBills.map((bill) => {
                const isPaid = bill.status === "paid";
                return (
                  <div
                    key={bill.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                            {bill.table_number ? `Table ${bill.table_number}` : "Takeaway / Direct"}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1">
                            #{bill.bill_number}
                          </h3>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isPaid ? "PAID" : "UNPAID"}
                        </span>
                      </div>

                      {/* Item Breakdown Preview */}
                      <div className="bg-slate-950 rounded-lg p-3 space-y-1.5 text-xs">
                        {bill.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300">
                            <span>
                              {item.quantity}x {item.item_name}
                            </span>
                            <span className="font-semibold text-slate-400">
                              ₹{(item.total_price ?? item.subtotal ?? (item.unit_price * item.quantity)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {bill.items.length > 3 && (
                          <p className="text-[10px] text-sky-400 pt-1">
                            +{bill.items.length - 3} more items...
                          </p>
                        )}
                      </div>

                      {/* Totals Summary */}
                      <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 text-xs">
                        <span className="text-slate-400 font-medium">Grand Total:</span>
                        <span className="text-lg font-bold text-emerald-400">
                          ₹{bill.grand_total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Cashier Action Buttons */}
                    <div className="pt-2 flex items-center space-x-2">
                      {!isPaid ? (
                        <button
                          onClick={() => handleOpenSettlement(bill)}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                        >
                          💵 Settle Bill
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePrintInvoice(bill.id)}
                          className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                        >
                          🖨️ Print Receipt
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settlement Modal */}
          {selectedBill && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>💵</span>
                      <span>Settle Bill #{selectedBill.bill_number}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedBill.table_number ? `Table ${selectedBill.table_number}` : "Takeaway / Direct"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBill(null)}
                    className="text-slate-400 hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Amount Due Box */}
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                    Total Amount Due
                  </p>
                  <h2 className="text-2xl font-extrabold text-white mt-1">
                    ₹{selectedBill.grand_total.toFixed(2)}
                  </h2>
                </div>

                <form onSubmit={handleConfirmSettlement} className="space-y-3.5">
                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Select Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          paymentMethod === "cash"
                            ? "bg-slate-800 text-white border-sky-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          paymentMethod === "card"
                            ? "bg-slate-800 text-white border-sky-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        💳 Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("upi")}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          paymentMethod === "upi"
                            ? "bg-slate-800 text-white border-sky-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        📱 UPI / QR
                      </button>
                    </div>
                  </div>

                  {/* Cash Change Calculator */}
                  {paymentMethod === "cash" && (
                    <div className="space-y-2.5 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Cash Tendered (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={cashTendered || ""}
                          onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 1000"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-sky-500 focus:outline-none"
                          required
                        />
                      </div>

                      {/* Quick Tender Buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setCashTendered(selectedBill.grand_total)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                        >
                          Exact
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashTendered(Math.ceil(selectedBill.grand_total / 100) * 100)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                        >
                          +Round
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashTendered(500)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                        >
                          ₹500
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashTendered(2000)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                        >
                          ₹2000
                        </button>
                      </div>

                      {/* Change Output */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Change Owed to Customer:</span>
                        <span className="text-base font-bold text-emerald-400">
                          ₹{changeReturn.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Notes / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes or reference code"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedBill(null)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                    >
                      {actionLoading ? "Processing..." : "Confirm & Settle"}
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

export default function CashierPOSPageWrapper() {
  return (
    <RouteGuard roles={["cashier", "manager", "admin"]}>
      <CashierPOSPage />
    </RouteGuard>
  );
}
