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
  customer_email?: string | null;
  rating: number;
  comment: string | null;
  is_verified: boolean;
  created_at: string;
}

function ReviewManagePage() {
  const { getToken } = useAuth();
  const { hasRole, isLoading } = useRBAC();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAuthorized = hasRole("manager") || hasRole("admin");

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/reviews/manage?include_hidden=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setReviews(await res.json());
    } catch (e: unknown) {
      setErrorMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthorized) load();
    else if (!isLoading) setLoading(false);
  }, [isLoading, isAuthorized]);

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
            <h1 className="text-lg font-bold text-white">⭐ Customer Feedback & Reviews</h1>
            <p className="text-xs text-gray-400">{reviews.length} total customer reviews</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        {errorMsg && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{errorMsg}</div>}

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">No reviews submitted yet.</div>
        ) : reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-400 font-mono tracking-tight text-sm">{stars(r.rating)}</span>
                  <span className="text-xs font-bold text-white">{r.display_name || "Anonymous"}</span>
                  {r.customer_email && (
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                      ✉️ {r.customer_email}
                    </span>
                  )}
                  {r.is_verified && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✓ Verified Customer</span>}
                </div>
                <p className="text-xs text-gray-400">{r.menu_item_name || "General Dish"} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {r.comment ? (
              <p className="text-sm text-gray-200 bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3">"{r.comment}"</p>
            ) : (
              <p className="text-xs text-gray-500 italic">No written comment provided.</p>
            )}
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
