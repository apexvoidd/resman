"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Review {
  id: string;
  menu_item_name: string | null;
  display_name: string | null;
  rating: number;
  comment: string | null;
  manager_reply: string | null;
  is_hidden: boolean;
  is_verified: boolean;
  created_at: string;
}

function ReviewManagePage() {
  const { getToken } = useAuth();
  const { hasRole, isLoading } = useRBAC();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAuthorized = hasRole("manager") || hasRole("admin");

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${API}/api/v1/reviews/manage?include_hidden=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!isLoading && isAuthorized) load();
    else if (!isLoading) setLoading(false);
  }, [isLoading, isAuthorized]);

  const handleReply = async (reviewId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      setSaving(reviewId);
      const res = await fetch(`${API}/api/v1/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText[reviewId] }),
      });
      if (!res.ok) throw new Error("Failed to save reply.");
      await load();
    } catch (e: unknown) { setErrorMsg((e as Error).message); }
    finally { setSaving(null); }
  };

  const handleToggleHide = async (reviewId: string, hide: boolean) => {
    const token = await getToken();
    if (!token) return;
    try {
      setSaving(reviewId);
      const endpoint = hide ? "hide" : "restore";
      await fetch(`${API}/api/v1/reviews/${reviewId}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (e: unknown) { setErrorMsg((e as Error).message); }
    finally { setSaving(null); }
  };

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  if (isLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
    </div>
  );

  if (!isAuthorized) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
      <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
        <span className="text-4xl">🚫</span>
        <h2 className="mt-3 text-lg font-bold text-red-400">Manager Access Only</h2>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">⭐ Customer Reviews</h1>
            <p className="text-xs text-gray-400">{reviews.length} total reviews</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        {errorMsg && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{errorMsg}</div>}

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">No reviews yet.</div>
        ) : reviews.map((r) => (
          <div key={r.id} className={`rounded-2xl border p-5 space-y-3 ${r.is_hidden ? "border-gray-700 bg-gray-900/40 opacity-60" : "border-gray-800 bg-gray-900"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-mono tracking-tight">{stars(r.rating)}</span>
                  <span className="text-xs font-bold text-white">{r.display_name || "Anonymous"}</span>
                  {r.is_verified && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✓ Verified</span>}
                  {r.is_hidden && <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-400">Hidden</span>}
                </div>
                <p className="text-xs text-gray-400">{r.menu_item_name || "Unknown item"} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleHide(r.id, !r.is_hidden)}
                disabled={saving === r.id}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${r.is_hidden ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                {r.is_hidden ? "Restore" : "Hide"}
              </button>
            </div>

            {r.comment && <p className="text-sm text-gray-300 bg-gray-950 rounded-xl px-4 py-3">"{r.comment}"</p>}

            {r.manager_reply && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-300">
                <span className="font-bold">Manager reply: </span>{r.manager_reply}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={replyText[r.id] ?? r.manager_reply ?? ""}
                onChange={(e) => setReplyText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Write a reply..."
                className="flex-1 rounded-xl bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleReply(r.id)}
                disabled={saving === r.id || !replyText[r.id]?.trim()}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                {saving === r.id ? "..." : "Reply"}
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function ReviewManageWrapper() {
  return (
    <RouteGuard permission="review:view">
      <ReviewManagePage />
    </RouteGuard>
  );
}
