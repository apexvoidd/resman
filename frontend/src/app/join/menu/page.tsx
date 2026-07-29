"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchGuestStatus, GuestStatusResponse } from "@/services/guest";
import { Category, fetchCategories, fetchMenuItems, MenuItem } from "@/services/menu";
import { cancelOrder, fetchSessionOrders, OrderOut, placeOrder, updateOrder } from "@/services/order";
import { useCartStore } from "@/store/use-cart-store";
import { fetchSessionBill, requestBill, BillData } from "@/services/billing";
import { getSafeImageUrl } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

export default function CustomerSeatedMenuPage() {
  const toast = useToast();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<GuestStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [billMsg, setBillMsg] = useState<string | null>(null);
  const [activeBill, setActiveBill] = useState<BillData | null>(null);
  const prevOrdersRef = useRef<Record<string, string>>({});

  const checkBill = async (st: string) => {
    try {
      const b = await fetchSessionBill(st);
      if (b) setActiveBill(b);
    } catch {
      // silent catch
    }
  };

  const handleRequestBill = async () => {
    if (!sessionToken) return;
    try {
      setErrorMsg(null);
      const res = await requestBill(sessionToken);
      setBillMsg(res.message);
      toast.success(res.message, "🧾 Bill Requested", 6000);
      await checkBill(sessionToken);
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to request bill.";
      setErrorMsg(msg);
      toast.error(msg, "Bill Request Failed");
    }
  };

  // Menu Data & Filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isVegetarian, setIsVegetarian] = useState<boolean>(false);

  // Cart Store
  const {
    items: cartItems,
    addItem,
    updateQuantity,
    updateInstructions,
    clearCart,
    getTotalItems,
    getSubtotal,
    getTax,
    getGrandTotal,
  } = useCartStore();

  // Modals State
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [sessionOrders, setSessionOrders] = useState<OrderOut[]>([]);

  // Editing order state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // 1. Initialize and verify arrival access
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("guest_session_token") : null;
        if (!token) {
          const msg = "No active guest session found. Please scan the entrance QR code.";
          setErrorMsg(msg);
          toast.error(msg, "Session Error");
          setLoading(false);
          return;
        }
        setSessionToken(token);

        const statusRes = await fetchGuestStatus(token);
        setSessionStatus(statusRes);

        const [catsData, itemsData] = await Promise.all([
          fetchCategories(null, true),
          fetchMenuItems(null, { page_size: 100 }),
        ]);

        setCategories(catsData);
        setItems(itemsData.items);
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || "Failed to initialize menu.";
        setErrorMsg(msg);
        toast.error(msg, "Menu Error");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;

    checkBill(sessionToken);
    loadSessionOrders();

    const interval = setInterval(() => {
      checkBill(sessionToken);
      loadSessionOrders();
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionToken]);

  // Filter items
  const filteredItems = items.filter((dish) => {
    if (selectedCategory && dish.category_id !== selectedCategory) return false;
    if (isVegetarian && !dish.is_vegetarian) return false;
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      return dish.name.toLowerCase().includes(term) || (dish.description || "").toLowerCase().includes(term);
    }
    return true;
  });

  const loadSessionOrders = async () => {
    if (!sessionToken) return;
    try {
      const data = await fetchSessionOrders(sessionToken);

      // Trigger floating popup toast for order status updates
      data.forEach((ord) => {
        const prevStatus = prevOrdersRef.current[ord.id];
        if (prevStatus && prevStatus !== ord.status) {
          if (ord.status === "ready") {
            toast.success(`🍽️ Order #${ord.order_number} is READY! Waiter will bring your food shortly.`, "Kitchen Update", 7000);
          } else if (ord.status === "preparing") {
            toast.info(`🔥 Kitchen started preparing Order #${ord.order_number}.`, "Kitchen Update", 5000);
          } else if (ord.status === "cancelled") {
            toast.warning(`❌ Order #${ord.order_number} was cancelled.`, "Order Status Update", 6000);
          } else if (ord.status === "served" || ord.status === "completed") {
            toast.success(`✨ Order #${ord.order_number} has been served! Enjoy your meal.`, "Order Served", 6000);
          }
        }
        prevOrdersRef.current[ord.id] = ord.status;
      });

      setSessionOrders(data);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load session orders.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!sessionToken || cartItems.length === 0) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payloadItems = cartItems.map((c) => ({
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        special_instructions: c.specialInstructions.trim() || undefined,
      }));

      await placeOrder(sessionToken, payloadItems);
      clearCart();
      setIsCartOpen(false);
      toast.success("🎉 Order submitted to kitchen successfully!", "Order Placed");
      await loadSessionOrders();
      setIsOrdersOpen(true);
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to place order.";
      setErrorMsg(msg);
      toast.error(msg, "Order Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!sessionToken || !confirm("Are you sure you want to cancel this order?")) return;

    try {
      setSubmitting(true);
      await cancelOrder(sessionToken, orderId);
      toast.success("Order cancelled successfully.", "Order Cancelled");
      await loadSessionOrders();
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to cancel order.";
      setErrorMsg(msg);
      toast.error(msg, "Cancellation Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Verifying Seated Session...</p>
        </div>
      </div>
    );
  }

  // Access Guard: Verification required before ordering
  const isVerified =
    sessionStatus?.verification_status === "confirmed" ||
    sessionStatus?.table_status === "occupied" ||
    sessionStatus?.menu_unlocked;

  if (!isVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-amber-500/20 bg-gray-900 p-6 text-center shadow-2xl space-y-4">
          <span className="text-4xl">🛑</span>
          <h2 className="text-lg font-bold text-amber-400">Arrival Verification Required</h2>
          <p className="text-sm text-gray-300">
            You must be seated at your assigned table and verified by staff before placing digital menu orders.
          </p>
          <Link
            href="/join"
            className="inline-block rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
          >
            Go to Check-In Page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-28">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-lg font-bold text-emerald-400 ring-1 ring-emerald-500/20">
              📍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">Table {sessionStatus?.table_number || "Seated"}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                  Verified Seated
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Guest: {sessionStatus?.guest_name || "Walk-in Guest"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeBill ? (
              <Link
                href={`/billing/${activeBill.id}`}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition"
              >
                💳 Pay Bill (₹{activeBill.grand_total.toFixed(2)})
              </Link>
            ) : (
              (() => {
                const hasIncomplete = sessionOrders.some(
                  (o) => !["completed", "ready", "served", "cancelled"].includes(o.status)
                );
                const hasOrders = sessionOrders.some((o) => o.status !== "cancelled");
                return (
                  <button
                    type="button"
                    onClick={handleRequestBill}
                    disabled={hasIncomplete || !hasOrders}
                    title={hasIncomplete ? "Wait for kitchen to complete all orders" : !hasOrders ? "No orders placed yet" : "Request final bill"}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                      hasIncomplete || !hasOrders
                        ? "border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                    }`}
                  >
                    🧾 {hasIncomplete ? "Orders in progress..." : "Request Bill"}
                  </button>
                );
              })()
            )}
            <button
              type="button"
              onClick={() => {
                loadSessionOrders();
                setIsOrdersOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 transition"
            >
              📋 My Orders
              {sessionOrders.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-gray-950">
                  {sessionOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {billMsg && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-300 flex items-center justify-between">
            <span>{billMsg}</span>
            <button onClick={() => setBillMsg(null)} className="text-xs text-amber-400 hover:underline">Dismiss</button>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Category Horizontal Pills */}
        <div className="flex overflow-x-auto gap-2 py-1 no-scrollbar">
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

        {/* Search & Dietary Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search dishes..."
            className="w-full sm:w-80 rounded-xl bg-gray-950 px-4 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsVegetarian(!isVegetarian)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ring-1 ${
              isVegetarian
                ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40"
                : "bg-gray-950 text-gray-400 ring-white/10 hover:text-white"
            }`}
          >
            🌱 Vegetarian Only
          </button>
        </div>

        {/* Menu Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((dish) => {
            const cartItem = cartItems.find((ci) => ci.menuItem.id === dish.id);
            const qty = cartItem ? cartItem.quantity : 0;

            return (
              <div
                key={dish.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden rounded-xl bg-gray-950 flex items-center justify-center">
                    {getSafeImageUrl(dish.image_url) ? (
                      <img
                        src={getSafeImageUrl(dish.image_url)!}
                        alt={dish.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          if (e.currentTarget.parentElement) {
                            const fallback = document.createElement("span");
                            fallback.className = "text-4xl";
                            fallback.innerText = "🍲";
                            e.currentTarget.parentElement.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-4xl">🍲</span>
                    )}
                    {!dish.is_available && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                        <span className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                          Currently Unavailable
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-bold text-white">{dish.name}</h3>
                      <span className="text-sm font-black text-emerald-400">₹{dish.price.toFixed(2)}</span>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">{dish.description || "Freshly cooked dish."}</p>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                      {dish.average_rating ? (
                        <span className="text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          ★ {dish.average_rating.toFixed(1)} ({dish.total_ratings})
                        </span>
                      ) : null}
                      <span>⏱️ {dish.preparation_time_minutes} min</span>
                      {dish.is_vegetarian && <span className="text-emerald-400">🌱 Veg</span>}
                    </div>
                  </div>
                </div>

                {/* Add to Cart Actions */}
                <div className="mt-4 pt-3 border-t border-gray-800">
                  {dish.is_available ? (
                    qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => addItem(dish, 1)}
                        className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-gray-950 hover:bg-amber-400 transition"
                      >
                        + Add to Cart
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-gray-950 p-1.5 ring-1 ring-amber-500/40">
                        <button
                          type="button"
                          onClick={() => updateQuantity(dish.id, qty - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-sm font-bold text-gray-200 hover:bg-gray-700"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-amber-400">{qty} in Cart</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(dish.id, qty + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-sm font-bold text-gray-200 hover:bg-gray-700"
                        >
                          +
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-gray-800 py-2 text-xs font-medium text-gray-500 cursor-not-allowed"
                    >
                      Currently Unavailable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* FLOATING CART SUMMARY BAR */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md">
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur">
            <div>
              <p className="text-xs font-semibold text-gray-400">{getTotalItems()} Items in Cart</p>
              <p className="text-lg font-black text-emerald-400">₹{getGrandTotal().toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="rounded-xl bg-amber-500 px-6 py-3 text-xs font-extrabold text-gray-950 hover:bg-amber-400 transition shadow-lg shadow-amber-500/20"
            >
              Review & Place Order →
            </button>
          </div>
        </div>
      )}

      {/* CART REVIEW & PLACE ORDER MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-white">Review Your Cart ({getTotalItems()} Items)</h2>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-4 divide-y divide-gray-800/60">
              {cartItems.map((ci) => (
                <div key={ci.menuItem.id} className="pt-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{ci.menuItem.name}</h4>
                      <p className="text-xs text-emerald-400 font-semibold">₹{ci.menuItem.price} each</p>
                    </div>
                    <span className="text-sm font-black text-white">₹{(ci.menuItem.price * ci.quantity).toFixed(2)}</span>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(ci.menuItem.id, ci.quantity - 1)}
                        className="h-7 w-7 rounded-lg bg-gray-800 text-xs font-bold text-gray-200"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-amber-400">{ci.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(ci.menuItem.id, ci.quantity + 1)}
                        className="h-7 w-7 rounded-lg bg-gray-800 text-xs font-bold text-gray-200"
                      >
                        +
                      </button>
                    </div>

                    {/* Special Instructions Input */}
                    <input
                      type="text"
                      value={ci.specialInstructions}
                      onChange={(e) => updateInstructions(ci.menuItem.id, e.target.value)}
                      placeholder="Special instructions (e.g. No Onion, Less Spicy)"
                      className="w-56 rounded-lg bg-gray-950 px-3 py-1.5 text-[11px] text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="rounded-xl bg-gray-950 p-4 space-y-2 border border-gray-800 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>₹{getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Taxes & GST (5%)</span>
                <span>₹{getTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-2 text-sm font-bold text-white">
                <span>Grand Total</span>
                <span className="text-emerald-400">₹{getGrandTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="rounded-xl bg-gray-800 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              >
                Continue Browsing
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                {submitting ? "Submitting Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION ORDERS HISTORY MODAL */}
      {isOrdersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-white">Your Dining Session Orders</h2>
              <button type="button" onClick={() => setIsOrdersOpen(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {sessionOrders.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-500">No orders placed yet in this session.</p>
            ) : (
              <div className="space-y-4">
                {sessionOrders.map((ord) => (
                  <div key={ord.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-amber-400">{ord.order_number}</span>
                        <p className="text-[10px] text-gray-500">{new Date(ord.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold ring-1 ${
                            ord.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 ring-amber-500/30 animate-pulse"
                              : ord.status === "cancelled"
                              ? "bg-red-500/10 text-red-400 ring-red-500/30"
                              : ord.status === "ready"
                              ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40 animate-bounce"
                              : "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                          }`}
                        >
                          {ord.status_message}
                        </span>
                        {ord.estimated_prep_minutes && ord.status !== "completed" && ord.status !== "cancelled" && (
                          <p className="text-[10px] text-emerald-400 font-semibold mt-1">
                            ⏱️ Est. Prep: {ord.estimated_prep_minutes} mins
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Live KDS Progress Bar */}
                    {ord.status !== "cancelled" && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 transition-all duration-1000"
                            style={{
                              width:
                                ord.status === "pending"
                                  ? "15%"
                                  : ord.status === "accepted"
                                  ? "40%"
                                  : ord.status === "preparing"
                                  ? "75%"
                                  : ord.status === "ready" || ord.status === "completed"
                                  ? "100%"
                                  : "0%",
                            }}
                          />
                        </div>
                        {ord.is_delayed && (
                          <p className="text-[10px] text-red-400 font-bold animate-pulse">
                            ⚠️ Kitchen is taking extra care — prep time slightly extended
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs text-gray-300">
                      {ord.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {item.quantity}x {item.menu_item_name}
                            {item.special_instructions && (
                              <span className="block text-[10px] text-amber-300">({item.special_instructions})</span>
                            )}
                          </span>
                          <span>₹{item.total_price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-800/80 pt-2 text-xs font-bold">
                      <span className="text-gray-400">Total: ₹{ord.final_amount.toFixed(2)}</span>

                      {ord.can_cancel && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(ord.id)}
                          disabled={submitting}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/20"
                        >
                          Cancel Pending Order
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Footer with Bill Action */}
            <div className="border-t border-gray-800 bg-gray-950 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Session Total ({sessionOrders.length} Orders):</p>
                <p className="text-sm font-bold text-emerald-400">
                  ₹{sessionOrders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.final_amount : 0), 0).toFixed(2)}
                </p>
              </div>

              {activeBill ? (
                <Link
                  href={`/billing/${activeBill.id}`}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
                >
                  💳 Pay Bill (₹{activeBill.grand_total.toFixed(2)})
                </Link>
              ) : (
                (() => {
                  const hasIncomplete = sessionOrders.some(
                    (o) => !["completed", "ready", "served", "cancelled"].includes(o.status)
                  );
                  const hasOrders = sessionOrders.some((o) => o.status !== "cancelled");
                  return (
                    <button
                      type="button"
                      onClick={handleRequestBill}
                      disabled={hasIncomplete || !hasOrders}
                      title={hasIncomplete ? "Wait for all orders to complete" : "Request final bill"}
                      className={`px-4 py-2.5 font-bold text-xs rounded-xl transition flex items-center gap-2 border ${
                        hasIncomplete || !hasOrders
                          ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50"
                          : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      🧾 {hasIncomplete ? "Kitchen busy..." : "Request Final Bill"}
                    </button>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
