"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BillData,
  calculateSplitBill,
  confirmCashPayment,
  createRazorpayOrder,
  getBill,
  getInvoiceHtmlUrl,
  requestCashSettlement,
  SplitBillResult,
  unlockSession,
  verifyRazorpayPayment,
} from "@/services/billing";

export default function BillingPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.billId as string;

  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Split Bill state
  const [splitType, setSplitType] = useState<"equal" | "item" | "custom">("equal");
  const [splitCount, setSplitCount] = useState<number>(2);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [splitResult, setSplitResult] = useState<SplitBillResult | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

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
      setErrorMsg(e.message || "Failed to load bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSplit = async () => {
    if (!bill) return;
    try {
      setIsSplitting(true);
      setErrorMsg(null);
      const res = await calculateSplitBill({
        bill_id: bill.id,
        split_type: splitType,
        split_count: splitCount,
        custom_amount: customAmount,
        order_item_ids: selectedItemIds,
      });
      setSplitResult(res);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to calculate split.");
    } finally {
      setIsSplitting(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!bill) return;
    try {
      setIsProcessingPayment(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const targetAmount = splitResult ? splitResult.share_amount : bill.grand_total;

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
              setSuccessMsg("Payment completed successfully!");
              await loadBillData();
            } catch (err: unknown) {
              const e = err as Error;
              setErrorMsg(e.message || "Payment verification failed. Please contact staff.");
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
        // Don't set isProcessingPayment to false here — handler or ondismiss will do it
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
        setSuccessMsg("Razorpay Payment verified & completed!");
        await loadBillData();
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Payment failed.");
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

      const targetAmount = splitResult ? splitResult.share_amount : bill.grand_total;

      if (authToken) {
        // Staff logged in — confirm cash payment directly
        await confirmCashPayment(authToken, bill.id, targetAmount, cashNotes);
        setSuccessMsg("Cash payment recorded & session closed!");
        await loadBillData();
      } else {
        // Customer on phone — request cash settlement from cashier/waiter
        const res = await requestCashSettlement(bill.id);
        setSuccessMsg(res.message || `Cash settlement request sent! Please pay ₹${targetAmount.toFixed(2)} to staff at your table or cashier counter.`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to record cash payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUnlockSession = async () => {
    if (!bill || !authToken || !bill.session_id) return;
    try {
      setErrorMsg(null);
      await unlockSession(authToken, bill.session_id);
      setSuccessMsg("Dining session unlocked by Manager.");
      await loadBillData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Only Manager can unlock session.");
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
            {/* Split Bill Options */}
            {!isPaid && (
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-white">Split Bill Options</h3>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => setSplitType("equal")}
                    className={`py-2 rounded-lg border ${
                      splitType === "equal"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    Equal Split
                  </button>
                  <button
                    onClick={() => setSplitType("item")}
                    className={`py-2 rounded-lg border ${
                      splitType === "item"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    By Item
                  </button>
                  <button
                    onClick={() => setSplitType("custom")}
                    className={`py-2 rounded-lg border ${
                      splitType === "custom"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {splitType === "equal" && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-400">Guests:</label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={splitCount}
                      onChange={(e) => setSplitCount(parseInt(e.target.value) || 2)}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white"
                    />
                  </div>
                )}

                {splitType === "custom" && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Custom Amount (₹):</label>
                    <input
                      type="number"
                      min="1"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                )}

                {splitType === "item" && (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {bill.items.map((it) => (
                      <label key={it.id} className="flex items-center justify-between text-xs text-slate-300">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(it.order_item_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds([...selectedItemIds, it.order_item_id]);
                              } else {
                                setSelectedItemIds(selectedItemIds.filter((id) => id !== it.order_item_id));
                              }
                            }}
                          />
                          {it.item_name}
                        </span>
                        <span>₹{it.total_price.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleCalculateSplit}
                  disabled={isSplitting}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                >
                  {isSplitting ? "Calculating..." : "Apply Split Share"}
                </button>

                {splitResult && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl text-xs space-y-1">
                    <p className="text-indigo-300 font-bold">{splitResult.message}</p>
                    <p className="text-slate-400">Share to pay now: <strong className="text-white">₹{splitResult.share_amount.toFixed(2)}</strong></p>
                  </div>
                )}
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
                      : `Pay ₹${(splitResult ? splitResult.share_amount : bill.grand_total).toFixed(2)} via Razorpay`}
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
                          ? `Confirm Cash Payment ₹${(splitResult ? splitResult.share_amount : bill.grand_total).toFixed(2)}`
                          : `🙋 Request Cash Settlement (₹${(splitResult ? splitResult.share_amount : bill.grand_total).toFixed(2)})`)}
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
