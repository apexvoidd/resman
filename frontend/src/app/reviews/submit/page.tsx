"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface OrderedItem {
  menu_item_id: string;
  menu_item_name: string;
}

interface ReviewDraft {
  menu_item_id: string;
  menu_item_name: string;
  rating: number;
  comment: string;
}

async function fetchOrderedItems(sessionToken: string): Promise<OrderedItem[]> {
  const res = await fetch(`${API}/api/v1/orders/session`, {
    headers: { "X-Session-Token": sessionToken },
  });
  if (!res.ok) return [];
  const orders = await res.json();
  const seen = new Set<string>();
  const items: OrderedItem[] = [];
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      if (!seen.has(item.menu_item_id)) {
        seen.add(item.menu_item_id);
        items.push({ menu_item_id: item.menu_item_id, menu_item_name: item.menu_item_name });
      }
    }
  }
  return items;
}

async function submitReview(sessionToken: string, draft: ReviewDraft): Promise<void> {
  const res = await fetch(`${API}/api/v1/reviews/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({
      menu_item_id: draft.menu_item_id,
      rating: draft.rating,
      comment: draft.comment.trim() || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to submit review.");
  }
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition"
        >
          <span className={(hover || value) >= star ? "text-amber-400" : "text-gray-600"}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function ReviewSubmitPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [items, setItems] = useState<OrderedItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("guest_session_token");
    if (!token) { setLoading(false); return; }
    setSessionToken(token);
    fetchOrderedItems(token).then((data) => {
      setItems(data);
      const initial: Record<string, ReviewDraft> = {};
      data.forEach((i) => {
        initial[i.menu_item_id] = { menu_item_id: i.menu_item_id, menu_item_name: i.menu_item_name, rating: 0, comment: "" };
      });
      setDrafts(initial);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (menuItemId: string) => {
    if (!sessionToken) return;
    const draft = drafts[menuItemId];
    if (!draft || draft.rating === 0) { setErrorMsg("Please select a star rating."); return; }
    try {
      setSubmitting(menuItemId);
      setErrorMsg(null);
      await submitReview(sessionToken, { ...draft, display_name: displayName } as ReviewDraft);
      setSubmitted((prev) => new Set([...prev, menuItemId]));
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center space-y-3">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-bold text-red-400">Session Not Found</h2>
          <p className="text-sm text-gray-400">No active dining session. Please scan the QR code to check in.</p>
        </div>
      </div>
    );
  }

  const allDone = items.length > 0 && items.every((i) => submitted.has(i.menu_item_id));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-16">
      <header className="border-b border-gray-800 bg-gray-900/80 px-6 py-4">
        <div className="mx-auto max-w-xl">
          <h1 className="text-lg font-bold text-white">⭐ Rate Your Food</h1>
          <p className="text-xs text-gray-400">Tell us how each dish was — it only takes a second!</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{errorMsg}</div>
        )}

        {allDone && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <span className="text-5xl">🎉</span>
            <h2 className="text-lg font-bold text-emerald-400">Thanks for your reviews!</h2>
            <p className="text-sm text-gray-400">Your feedback helps us improve every dish.</p>
            <button onClick={() => router.push("/")} className="mt-2 px-6 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-xl text-sm transition">
              Back to Home
            </button>
          </div>
        )}

        {/* Display name (shared across all reviews) */}
        {!allDone && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-2">
            <label className="text-xs font-semibold text-gray-300">Your Name (optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
              placeholder="e.g. Rahul, Anonymous..."
              className="w-full rounded-xl bg-gray-950 px-4 py-2 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        )}

        {items.map((item) => {
          const draft = drafts[item.menu_item_id];
          const done = submitted.has(item.menu_item_id);
          if (!draft) return null;
          return (
            <div key={item.menu_item_id} className={`rounded-2xl border p-5 space-y-3 transition ${done ? "border-emerald-500/30 bg-emerald-950/10 opacity-70" : "border-gray-800 bg-gray-900"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{item.menu_item_name}</h3>
                {done && <span className="text-xs font-bold text-emerald-400">✓ Reviewed</span>}
              </div>

              {!done && (
                <>
                  <StarPicker
                    value={draft.rating}
                    onChange={(v) => setDrafts((prev) => ({ ...prev, [item.menu_item_id]: { ...prev[item.menu_item_id], rating: v } }))}
                  />
                  <textarea
                    value={draft.comment}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [item.menu_item_id]: { ...prev[item.menu_item_id], comment: e.target.value.slice(0, 500) } }))}
                    placeholder="Any comments? (optional)"
                    rows={2}
                    className="w-full rounded-xl bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmit(item.menu_item_id)}
                    disabled={submitting === item.menu_item_id || draft.rating === 0}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    {submitting === item.menu_item_id ? "Submitting..." : "Submit Review"}
                  </button>
                </>
              )}
            </div>
          );
        })}

        {items.length === 0 && !loading && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
            No items to review. Place an order first!
          </div>
        )}
      </main>
    </div>
  );
}
