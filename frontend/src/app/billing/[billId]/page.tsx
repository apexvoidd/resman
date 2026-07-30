"use client";
// v2

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BillData,
  confirmCashPayment,
  createRazorpayOrder,
  getBill,
  getInvoiceHtmlUrl,
  requestCashSettlement,
  unlockSession,
  verifyRazorpayPayment,
} from "@/services/billing";
import { useToast } from "@/context/ToastContext";

export default function BillingPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const billId = params.billId as string;

  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Split calculator state (frontend only)
  const [splitCount, setSplitCount] = useState<number>(2);

  // Payment Method selection
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking" | "cash">("upi");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Manager unlock token / role state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [cashNotes, setCashNotes] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    setAuthToken(t);

    if (billId) {
      loadBillData();
    }
  }, [billId]);

  // Live polling interval so customer screen updates automatically when cashier settles bill
  useEffect(() => {
    if (!billId || bill?.status === "paid") return;

    const interval = setInterval(() => {
      pollBillData();
    }, 2000);

    return () => clearInterval(interval);
  }, [billId, bill?.status]);

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const loadBillData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await getBill(billId);
      setBill(data);
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to load bill.";
      setErrorMsg(msg);
      toast.error(msg, "Bill Error");
    } finally {
      setLoading(false);
    }
  };

  const pollBillData = async () => {
    if (!billId) return;
    try {
      const data = await getBill(billId);
      setBill((prev) => {
        if (prev && prev.status !== "paid" && data.status === "paid") {
          const msg = "Payment Confirmed & Settled by Cashier! 🎉 Thank you for dining with us.";
          setSuccessMsg(msg);
          toast.success(msg, "Bill Settled", 8000);
        }
        return data;
      });
    } catch {
      // Ignore background polling errors
    }
  };

  // Per-person share — pure frontend calculation
  const perPersonShare = bill ? bill.grand_total / Math.max(splitCount, 1) : 0;

  const handleRazorpayPayment = async () => {
    if (!bill) return;
    try {
      setIsProcessingPayment(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const targetAmount = splitCount > 1 ? perPersonShare : bill.grand_total;

      // 1. Create Razorpay order on backend
      const rzpOrder = await createRazorpayOrder(bill.id, targetAmount);

      // 2. Open Razorpay modal if script available, or simulate backend HMAC verification
      if (typeof window !== "undefined" && (window as unknown as { Razorpay: unknown }).Razorpay) {
        const options = {
          key: rzpOrder.key_id,
          amount: rzpOrder.amount_paise,
          currency: "INR",
          name: "Smart Restaurant",
          description: `Bill ${bill.bill_number}`,
          order_id: rzpOrder.razorpay_order_id,
          prefill: {
            name: bill.guest_name || "",
            email: bill.guest_email || "",
          },
          config: {
            display: {
              blocks: {
                utib: {
                  name: "Pay using UPI",
                  instruments: [
                    { method: "upi" },
                  ],
                },
                other: {
                  name: "Other Payment Methods",
                  instruments: [
                    { method: "card" },
                    { method: "netbanking" },
                    { method: "wallet" },
                  ],
                },
              },
              sequence: ["block.utib", "block.other"],
              preferences: {
                show_default_blocks: false,
              },
            },
          },
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
            try {
              // 3. Backend HMAC Verification
              await verifyRazorpayPayment({
                bill_id: bill.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: targetAmount,
              });
              const msg = "Payment completed successfully! 🎉";
              setSuccessMsg(msg);
              toast.success(msg, "Payment Success", 8000);
              await loadBillData();
            } catch (err: unknown) {
              const e = err as Error;
              const msg = e.message || "Payment verification failed. Please contact staff.";
              setErrorMsg(msg);
              toast.error(msg, "Payment Verification Error");
            } finally {
              setIsProcessingPayment(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessingPayment(false);
              setErrorMsg(null);
            },
          },
          theme: { color: "#6366f1" },
        };
        const rzp = new (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay(options);
        rzp.open();
        return;
      } else {
        // Dev fallback simulation with HMAC backend verification
        const mockPayId = `pay_mock_${Date.now()}`;
        const mockSig = `sig_mock_${Date.now()}`;
        await verifyRazorpayPayment({
          bill_id: bill.id,
          razorpay_order_id: rzpOrder.razorpay_order_id,
          razorpay_payment_id: mockPayId,
          razorpay_signature: mockSig,
          amount: targetAmount,
        });
        const msg = "Razorpay Payment verified & completed!";
        setSuccessMsg(msg);
        toast.success(msg, "Payment Verified", 8000);
        await loadBillData();
      }
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Payment failed.";
      setErrorMsg(msg);
      toast.error(msg, "Payment Error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCashPayment = async () => {
    if (!bill) return;
    try {
      setIsProcessingPayment(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const targetAmount = splitCount > 1 ? perPersonShare : bill.grand_total;

      if (authToken) {
        // Staff logged in — confirm cash payment directly
        await confirmCashPayment(authToken, bill.id, targetAmount, cashNotes);
        const msg = "Cash payment recorded & session closed!";
        setSuccessMsg(msg);
        toast.success(msg, "Cash Settled", 6000);
        await loadBillData();
      } else {
        // Customer on phone — request cash settlement from cashier/waiter
        const res = await requestCashSettlement(bill.id);
        const msg = res.message || `Cash settlement request sent! Please pay ₹${targetAmount.toFixed(2)} to staff at your table or cashier counter.`;
        setSuccessMsg(msg);
        toast.success(msg, "Cash Request Sent", 7000);
      }
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to record cash payment.";
      setErrorMsg(msg);
      toast.error(msg, "Cash Error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUnlockSession = async () => {
    if (!bill || !authToken || !bill.session_id) return;
    try {
      setErrorMsg(null);
      await unlockSession(authToken, bill.session_id);
      const msg = "Dining session unlocked by Manager.";
      setSuccessMsg(msg);
      toast.success(msg, "Session Unlocked");
      await loadBillData();
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Only Manager can unlock session.";
      setErrorMsg(msg);
      toast.error(msg, "Unlock Error");
    }
  };

  const handlePrintInvoice = () => {
    if (!bill) return;
    const url = getInvoiceHtmlUrl(bill.id);
    const win = window.open(url, "_blank");
    if (win) {
      win.focus();
      setTimeout(() => win.print(), 1000);
    }
  };

  const handleDownloadInvoice = () => {
    if (!bill) return;
    const url = getInvoiceHtmlUrl(bill.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${bill.bill_number}.html`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-2">Bill Not Found</h2>
        <p className="text-slate-400 mb-6">{errorMsg || "Invalid bill identifier."}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium"
        >
          Return Home
        </button>
      </div>
    );
  }

  const isPaid = bill.status === "paid";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur border border-slate-800 p-6 rounded-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">
                Tax Invoice {bill.bill_number}
              </h1>
              <span
                className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wider ${
                  isPaid
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                {bill.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Table Number: <strong className="text-white">{bill.table_number || "N/A"}</strong> | Guest:{" "}
              <span className="text-white">{bill.guest_name || "Valued Customer"}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintInvoice}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition"
            >
              🖨️ Print Invoice
            </button>
            <button
              onClick={handleDownloadInvoice}
              className="px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-semibold transition"
            >
              📥 Download PDF
            </button>
          </div>
        </div>

        {/* Banners */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-sm font-medium">
            {successMsg}
          </div>
        )}

        {/* Lock Banner & Unlock */}
        {bill.is_locked && !isPaid && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h4 className="font-semibold text-amber-300">Dining Session Locked</h4>
                <p className="text-xs text-amber-400/80">
                  New orders are disabled while bill is being settled.
                </p>
              </div>
            </div>
            {authToken && (
              <button
                onClick={handleUnlockSession}
                className="px-3.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold"
              >
                Manager Unlock
              </button>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Itemized Table */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
              Itemized Summary
            </h3>
            <div className="divide-y divide-slate-800/60">
              {bill.items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-200">{item.item_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × ₹{item.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <span className="font-bold text-slate-100">₹{item.total_price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="border-t border-slate-800 pt-4 space-y-2 text-sm text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-slate-200">₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>GST Tax ({bill.tax_percentage}%)</span>
                <span className="text-slate-300">₹{bill.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Service Charge ({bill.service_charge_percentage}%)</span>
                <span className="text-slate-300">₹{bill.service_charge_amount.toFixed(2)}</span>
              </div>
              {bill.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>-₹{bill.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {bill.tip_amount > 0 && (
                <div className="flex justify-between text-indigo-300">
                  <span>Tip</span>
                  <span>+₹{bill.tip_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold text-white border-t border-slate-700 pt-3">
                <span>Grand Total</span>
                <span className="text-emerald-400">₹{bill.grand_total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Split Bill Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Split Calculator */}
            {!isPaid && (
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-white">Split Bill</h3>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-slate-400">Number of People</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSplitCount((n) => Math.max(1, n - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-white font-semibold text-sm">{splitCount}</span>
                    <button
                      onClick={() => setSplitCount((n) => Math.min(20, n + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {splitCount === 1 ? "Full bill" : `Each person pays`}
                  </span>
                  <span className="text-lg font-extrabold text-indigo-300">
                    ₹{perPersonShare.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Method & Checkout */}
            {!isPaid ? (
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-white">Select Payment Method</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => setPaymentMethod("upi")}
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      paymentMethod === "upi"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    📱 UPI / QR
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      paymentMethod === "card"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    💳 Card
                  </button>
                  <button
                    onClick={() => setPaymentMethod("netbanking")}
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      paymentMethod === "netbanking"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    🏛️ Net Banking
                  </button>
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      paymentMethod === "cash"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    💵 Cash
                  </button>
                </div>

                {paymentMethod === "cash" && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Cashier Notes / Receipt Ref:</label>
                    <input
                      type="text"
                      placeholder="e.g. Received at register 1"
                      value={cashNotes}
                      onChange={(e) => setCashNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                )}

                {paymentMethod !== "cash" ? (
                  <button
                    onClick={handleRazorpayPayment}
                    disabled={isProcessingPayment}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 text-sm transition"
                  >
                    {isProcessingPayment
                      ? "Verifying Razorpay Signature..."
                      : `Pay ₹${(splitCount > 1 ? perPersonShare : bill.grand_total).toFixed(2)} via Razorpay`}
                  </button>
                ) : (
                  <button
                    onClick={handleCashPayment}
                    disabled={isProcessingPayment}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg shadow-amber-600/20 text-sm transition"
                  >
                    {isProcessingPayment
                      ? (authToken ? "Recording Cash Payment..." : "Sending Cash Request...")
                      : (authToken
                          ? `Confirm Cash Payment ₹${(splitCount > 1 ? perPersonShare : bill.grand_total).toFixed(2)}`
                          : `🙋 Request Cash Settlement (₹${(splitCount > 1 ? perPersonShare : bill.grand_total).toFixed(2)})`)}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-3">
                <span className="text-4xl">🎉</span>
                <h3 className="text-lg font-bold text-emerald-400">Bill Fully Settled</h3>
                <p className="text-xs text-slate-400">
                  Dining session is closed and table status is updated to Cleaning.
                </p>
                {bill.can_submit_review && (
                  <button
                    onClick={() => router.push(`/reviews/submit`)}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                  >
                    ⭐ Leave a Review
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
