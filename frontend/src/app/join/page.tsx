"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  cancelGuestReservation,
  fetchGuestStatus,
  findGuestTable,
  GuestStatusResponse,
  initGuestSession,
  markAtTable,
} from "@/services/guest";

export default function JoinPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form state
  const [guestCount, setGuestCount] = useState<number>(2);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Status & Reservation state
  const [statusData, setStatusData] = useState<GuestStatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number | null>(null);

  // 1. Initialize guest session on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("guest_session_token") : null;
        const session = await initGuestSession(storedToken);

        if (typeof window !== "undefined") {
          localStorage.setItem("guest_session_token", session.session_token);
        }
        setSessionToken(session.session_token);

        // Fetch current live status
        const statusRes = await fetchGuestStatus(session.session_token);
        setStatusData(statusRes);

        if (statusRes.remaining_seconds) {
          setCountdown(statusRes.remaining_seconds);
        }
        if (statusRes.cooldown_remaining_seconds) {
          setCooldownTimer(statusRes.cooldown_remaining_seconds);
        }
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "Failed to initialize guest session.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Countdown timer effect for 5-minute table reservation
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (sessionToken) {
            fetchGuestStatus(sessionToken).then(setStatusData).catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, sessionToken]);

  // 3. Cooldown timer effect
  useEffect(() => {
    if (cooldownTimer === null || cooldownTimer <= 0) return;

    const interval = setInterval(() => {
      setCooldownTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownTimer]);

  // 4. Live Polling for Verification State Changes (every 3 seconds when awaiting verification)
  useEffect(() => {
    if (!sessionToken || statusData?.verification_status !== "awaiting_verification") return;

    const pollInterval = setInterval(() => {
      fetchGuestStatus(sessionToken)
        .then((res) => {
          setStatusData(res);
          if (res.remaining_seconds) setCountdown(res.remaining_seconds);
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [sessionToken, statusData?.verification_status]);

  const handleFindTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await findGuestTable(sessionToken, {
        guest_count: guestCount,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });

      setStatusData({
        session_token: res.session_token,
        guest_name: name.trim() || null,
        guest_count: guestCount,
        has_active_reservation: res.assigned,
        table_id: res.table_id,
        table_number: res.table_number,
        capacity: res.capacity,
        reservation_expires_at: res.reservation_expires_at,
        remaining_seconds: res.remaining_seconds,
        verification_status: res.verification_status || "none",
        rejection_reason: res.rejection_reason,
        menu_unlocked: res.menu_unlocked || false,
        in_queue: res.in_queue,
        queue_id: res.queue_id,
        queue_position: res.queue_position,
        estimated_wait_minutes: res.estimated_wait_minutes,
        cooldown_active: res.cooldown_active,
        cooldown_remaining_seconds: res.cooldown_remaining_seconds,
        message: res.message,
      });

      if (res.remaining_seconds) {
        setCountdown(res.remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to reserve a table.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImAtTable = async () => {
    if (!sessionToken) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await markAtTable(sessionToken);
      setStatusData(res);
      if (res.remaining_seconds) {
        setCountdown(res.remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to notify waiter.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionToken) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await cancelGuestReservation(sessionToken);
      setStatusData(res);
      setCountdown(null);

      if (res.cooldown_remaining_seconds) {
        setCooldownTimer(res.cooldown_remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to cancel reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    if (!sessionToken) return;

    try {
      setSubmitting(true);
      const statusRes = await fetchGuestStatus(sessionToken);
      setStatusData(statusRes);

      if (statusRes.remaining_seconds) {
        setCountdown(statusRes.remaining_seconds);
      } else {
        setCountdown(null);
      }

      if (statusRes.cooldown_remaining_seconds) {
        setCooldownTimer(statusRes.cooldown_remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to refresh status.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-medium text-gray-400">Initializing Entrance QR Session...</p>
        </div>
      </div>
    );
  }

  const hasReservation = statusData?.has_active_reservation && statusData?.table_number;
  const inQueue = statusData?.in_queue;
  const isCooldown = (cooldownTimer !== null && cooldownTimer > 0) || statusData?.cooldown_active;
  const isVerified = statusData?.verification_status === "confirmed" || statusData?.table_status === "occupied" || statusData?.menu_unlocked;
  const isAwaiting = statusData?.verification_status === "awaiting_verification" || statusData?.table_status === "awaiting_verification";
  const isRejected = statusData?.verification_status === "rejected";

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl font-bold text-amber-400 ring-1 ring-amber-500/20">
            🍽️
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Smart Entrance Check-In</h1>
          <p className="mt-1 text-sm text-gray-400">Scan entrance QR & get instant table allocation</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Cooldown Alert */}
        {isCooldown && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            <span className="font-semibold">Cancellation Cooldown:</span> Please wait{" "}
            <span className="font-mono font-bold text-white">{cooldownTimer ? formatTimer(cooldownTimer) : "5:00"}</span>{" "}
            before requesting another table.
          </div>
        )}

        {/* 1. ASSIGNED TABLE RESERVED STATE */}
        {hasReservation ? (
          <div className="space-y-6 rounded-2xl border border-emerald-500/20 bg-gray-900/90 p-6 backdrop-blur shadow-xl">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  isVerified
                    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                    : isAwaiting
                    ? "bg-amber-500/10 text-amber-400 ring-amber-500/20 animate-pulse"
                    : isRejected
                    ? "bg-red-500/10 text-red-400 ring-red-500/20"
                    : "bg-blue-500/10 text-blue-400 ring-blue-500/20"
                }`}
              >
                {isVerified
                  ? "Occupied & Verified"
                  : isAwaiting
                  ? "Awaiting Waiter Verification"
                  : isRejected
                  ? "Verification Rejected"
                  : "Table Reserved"}
              </span>
              <span className="text-xs text-gray-400">Entrance Assignment</span>
            </div>

            <div className="text-center py-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">Your Assigned Table</p>
              <div className="mt-2 text-6xl font-black tracking-tight text-emerald-400">
                {statusData.table_number}
              </div>
              <p className="mt-2 text-sm text-gray-300">
                Capacity: <span className="font-semibold text-white">{statusData.capacity} Guests</span>
              </p>
            </div>

            {/* VERIFICATION STATE BANNERS */}
            {isVerified ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                <p className="text-sm font-semibold text-emerald-400">✅ Arrival Confirmed by Waiter</p>
                <p className="mt-1 text-xs text-emerald-300">Welcome! Your digital menu access is unlocked.</p>
              </div>
            ) : isAwaiting ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center animate-pulse">
                <p className="text-sm font-semibold text-amber-400">⏳ Waiter Notified</p>
                <p className="mt-1 text-xs text-amber-300">Staff will arrive at Table {statusData.table_number} shortly to verify.</p>
              </div>
            ) : isRejected ? (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                <p className="text-sm font-semibold text-red-400">❌ Verification Rejected</p>
                <p className="mt-1 text-xs text-red-300">
                  {statusData.rejection_reason || "Staff could not locate your party at the table."}
                </p>
              </div>
            ) : null}

            {/* Countdown timer (show when not verified yet) */}
            {!isVerified && countdown !== null && countdown > 0 && (
              <div className="rounded-xl bg-gray-950 p-4 text-center ring-1 ring-white/10">
                <p className="text-xs text-gray-400">Reservation Expiration Timer</p>
                <div className="my-1 font-mono text-3xl font-bold tracking-wider text-amber-400">
                  {formatTimer(countdown)}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${(countdown / 300) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">Please proceed to your table within 5 minutes</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {/* "I'm at my table" Action Button */}
              {!isVerified && !isAwaiting && (
                <button
                  type="button"
                  onClick={handleImAtTable}
                  disabled={submitting}
                  className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-gray-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  {submitting ? "Notifying Staff..." : "📍 I'm at my Table"}
                </button>
              )}

              {isVerified && (
                <Link
                  href="/join/menu"
                  className="w-full text-center rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-gray-950 hover:bg-emerald-400 transition block shadow-lg shadow-emerald-500/10"
                >
                  📖 Browse Digital Menu & Place Order
                </Link>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={submitting}
                className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition disabled:opacity-50"
              >
                Refresh Status
              </button>

              {!isVerified && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                >
                  Cancel Reservation
                </button>
              )}
            </div>
          </div>
        ) : inQueue ? (
          /* 2. WAITING QUEUE STATE */
          <div className="space-y-6 rounded-2xl border border-amber-500/20 bg-gray-900/90 p-6 backdrop-blur shadow-xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/20">
                In Waitlist Queue
              </span>
              <span className="text-xs text-gray-400">Walk-in Queue</span>
            </div>

            <div className="text-center py-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">Your Position in Line</p>
              <div className="mt-2 text-6xl font-black tracking-tight text-amber-400">
                #{statusData.queue_position}
              </div>
              <p className="mt-2 text-sm text-gray-300">
                Estimated Wait:{" "}
                <span className="font-semibold text-white">~{statusData.estimated_wait_minutes} Minutes</span>
              </p>
            </div>

            <p className="text-center text-xs text-gray-400">
              All tables matching {statusData.guest_count || guestCount} guests are currently occupied. We will assign the next table automatically.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={submitting}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                Refresh Queue Position
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                Leave Queue
              </button>
            </div>
          </div>
        ) : (
          /* 3. INPUT FORM STATE */
          <form onSubmit={handleFindTable} className="space-y-5 rounded-2xl border border-gray-800 bg-gray-900/90 p-6 shadow-xl backdrop-blur">
            <div>
              <label className="block text-xs font-medium text-gray-300">
                Number of Guests <span className="text-red-400">*</span>
              </label>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-950 p-2 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-300 hover:bg-gray-700 transition"
                >
                  -
                </button>
                <span className="text-xl font-bold text-white">{guestCount} Guests</span>
                <button
                  type="button"
                  onClick={() => setGuestCount((prev) => Math.min(20, prev + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-300 hover:bg-gray-700 transition"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Guest Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || Boolean(isCooldown)}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
            >
              {submitting ? "Allocating Table..." : "Find Table"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
