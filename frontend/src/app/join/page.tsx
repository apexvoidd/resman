"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  cancelGuestReservation,
  fetchGuestStatus,
  findGuestTable,
  GuestStatusResponse,
  initGuestSession,
  markAtTable,
} from "@/services/guest";
import { useToast } from "@/context/ToastContext";

export default function JoinPage() {
  const toast = useToast();
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
  const prevVerificationRef = useRef<string | null | undefined>(null);

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
        prevVerificationRef.current = statusRes.verification_status;

        if (statusRes.remaining_seconds) {
          setCountdown(statusRes.remaining_seconds);
        }
        if (statusRes.cooldown_remaining_seconds) {
          setCooldownTimer(statusRes.cooldown_remaining_seconds);
        }
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || "Failed to initialize guest session.";
        setErrorMsg(msg);
        toast.error(msg, "Session Error");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [toast]);

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

  // 4. Live Polling — runs when awaiting verification OR in queue
  useEffect(() => {
    if (!sessionToken) return;
    const isAwaiting = statusData?.verification_status === "awaiting_verification";
    const isInQueue = statusData?.in_queue === true;
    if (!isAwaiting && !isInQueue) return;

    const pollInterval = setInterval(() => {
      fetchGuestStatus(sessionToken)
        .then((res) => {
          if (prevVerificationRef.current !== res.verification_status) {
            if (res.verification_status === "confirmed" || res.table_status === "occupied" || res.menu_unlocked) {
              toast.success("🎉 Arrival verified by waiter! Digital menu access is now unlocked.", "Verified Seated", 7000);
            } else if (res.verification_status === "rejected") {
              toast.error(res.rejection_reason || "Verification rejected by staff.", "Verification Failed", 7000);
            }
            prevVerificationRef.current = res.verification_status;
          }
          setStatusData(res);
          if (res.remaining_seconds) setCountdown(res.remaining_seconds);
          if (res.cooldown_remaining_seconds) setCooldownTimer(res.cooldown_remaining_seconds);
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [sessionToken, statusData?.verification_status, statusData?.in_queue, toast]);

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

      if (res.assigned && res.table_number) {
        toast.success(`🎉 Table ${res.table_number} assigned! Please proceed to your table within 5 minutes.`, "Table Assigned", 7000);
      } else if (res.in_queue) {
        toast.info(res.message || `All matching tables occupied. You are #${res.queue_position} in line.`, "Waitlist Queue", 7000);
      }

      if (res.remaining_seconds) {
        setCountdown(res.remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to reserve a table.";
      setErrorMsg(msg);
      toast.error(msg, "Check-In Failed");
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
      toast.success("📍 Waiter notified! Staff will verify your arrival shortly.", "Staff Notified", 6000);
      if (res.remaining_seconds) {
        setCountdown(res.remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to notify waiter.";
      setErrorMsg(msg);
      toast.error(msg, "Notification Failed");
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
      toast.info("Table reservation cancelled.", "Cancelled", 5000);

      if (res.cooldown_remaining_seconds) {
        setCooldownTimer(res.cooldown_remaining_seconds);
      }
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to cancel reservation.";
      setErrorMsg(msg);
      toast.error(msg, "Cancellation Failed");
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
      toast.info("Status updated.", "Refreshed", 3000);

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
      const msg = e.message || "Failed to refresh status.";
      setErrorMsg(msg);
      toast.error(msg, "Refresh Error");
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
      <div className="flex min-h-screen items-center justify-center bg-[#FFF7ED] text-[#1E293B]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F97316] border-t-transparent" />
          <p className="text-sm font-semibold text-[#EA580C]">Initializing Entrance QR Session...</p>
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
    <div className="min-h-screen bg-[#FFF7ED] px-4 py-8 text-[#1E293B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316]/10 text-2xl font-bold text-[#F97316] border border-[#F97316]/20 shadow-sm">
            🍽️
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] tracking-tight">Smart Entrance Check-In</h1>
          <p className="mt-1 text-sm text-[#EA580C] font-medium">Scan entrance QR & get instant table allocation</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Cooldown Alert */}
        {isCooldown && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">Cancellation Cooldown:</span> Please wait{" "}
            <span className="font-mono font-bold text-[#F97316]">{cooldownTimer ? formatTimer(cooldownTimer) : "5:00"}</span>{" "}
            before requesting another table.
          </div>
        )}

        {/* 1. ASSIGNED TABLE RESERVED STATE */}
        {hasReservation ? (
          <div className="space-y-6 rounded-2xl border border-orange-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isVerified
                    ? "bg-emerald-100 text-emerald-700"
                    : isAwaiting
                    ? "bg-amber-100 text-amber-700 animate-pulse"
                    : isRejected
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
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
              <span className="text-xs text-slate-500">Entrance Assignment</span>
            </div>

            <div className="text-center py-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Your Assigned Table</p>
              <div className="mt-2 text-6xl font-black tracking-tight text-[#F97316]">
                {statusData.table_number}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Capacity: <span className="font-bold text-[#1E293B]">{statusData.capacity} Guests</span>
              </p>
            </div>

            {/* VERIFICATION STATE BANNERS */}
            {isVerified ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-sm font-semibold text-emerald-800">✅ Arrival Confirmed by Waiter</p>
                <p className="mt-1 text-xs text-emerald-600">Welcome! Your digital menu access is unlocked.</p>
              </div>
            ) : isAwaiting ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center animate-pulse">
                <p className="text-sm font-semibold text-amber-800">⏳ Waiter Notified</p>
                <p className="mt-1 text-xs text-amber-600">Staff will arrive at Table {statusData.table_number} shortly to verify.</p>
              </div>
            ) : isRejected ? (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
                <p className="text-sm font-semibold text-red-800">❌ Verification Rejected</p>
                <p className="mt-1 text-xs text-red-600">
                  {statusData.rejection_reason || "Staff could not locate your party at the table."}
                </p>
              </div>
            ) : null}

            {/* Countdown timer */}
            {!isVerified && countdown !== null && countdown > 0 && (
              <div className="rounded-xl bg-[#FFF7ED] p-4 text-center border border-orange-200">
                <p className="text-xs text-slate-500">Reservation Expiration Timer</p>
                <div className="my-1 font-mono text-3xl font-bold tracking-wider text-[#F97316]">
                  {formatTimer(countdown)}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-orange-200">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-[#F97316] transition-all duration-1000"
                    style={{ width: `${(countdown / 300) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Please proceed to your table within 5 minutes</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {!isVerified && !isAwaiting && (
                <button
                  type="button"
                  onClick={handleImAtTable}
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#F97316] py-3.5 text-sm font-bold text-white hover:bg-[#EA580C] transition shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {submitting ? "Notifying Staff..." : "📍 I'm at my Table"}
                </button>
              )}

              {isVerified && (
                <Link
                  href="/join/menu"
                  className="w-full text-center rounded-xl bg-[#F97316] py-3.5 text-sm font-bold text-white hover:bg-[#EA580C] transition block shadow-lg shadow-orange-500/20"
                >
                  📖 Browse Digital Menu & Place Order
                </Link>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={submitting}
                className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-[#1E293B] hover:bg-slate-200 transition disabled:opacity-50 border border-slate-200"
              >
                Refresh Status
              </button>

              {!isVerified && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                >
                  Cancel Reservation
                </button>
              )}
            </div>
          </div>
        ) : inQueue ? (
          /* 2. WAITING QUEUE STATE */
          <div className="space-y-6 rounded-2xl border border-orange-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                In Waitlist Queue
              </span>
              <span className="text-xs text-slate-500">Walk-in Queue</span>
            </div>

            <div className="text-center py-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Your Position in Line</p>
              <div className="mt-2 text-6xl font-black tracking-tight text-[#F97316]">
                #{statusData.queue_position}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Estimated Wait:{" "}
                <span className="font-bold text-[#1E293B]">~{statusData.estimated_wait_minutes} Minutes</span>
              </p>
            </div>

            <p className="text-center text-xs text-slate-500">
              All tables matching {statusData.guest_count || guestCount} guests are currently occupied. We will assign the next table automatically.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={submitting}
                className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-semibold text-white hover:bg-[#EA580C] transition disabled:opacity-50 shadow-md"
              >
                Refresh Queue Position
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
              >
                Leave Queue
              </button>
            </div>
          </div>
        ) : (
          /* 3. INPUT FORM STATE */
          <form onSubmit={handleFindTable} className="space-y-5 rounded-2xl border border-orange-200 bg-white p-6 shadow-xl">
            <div>
              <label className="block text-xs font-semibold text-[#1E293B]">
                Number of Guests <span className="text-red-500">*</span>
              </label>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#FFF7ED] p-2 border border-orange-200">
                <button
                  type="button"
                  onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-orange-200 text-lg font-bold text-[#1E293B] hover:bg-orange-100 transition"
                >
                  -
                </button>
                <span className="text-xl font-bold text-[#1E293B]">{guestCount} Guests</span>
                <button
                  type="button"
                  onClick={() => setGuestCount((prev) => Math.min(20, prev + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-orange-200 text-lg font-bold text-[#1E293B] hover:bg-orange-100 transition"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B]">Guest Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1.5 w-full rounded-xl bg-[#FFF7ED] px-4 py-3 text-sm text-[#1E293B] placeholder-slate-400 border border-orange-200 focus:border-[#F97316] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B]">Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                className="mt-1.5 w-full rounded-xl bg-[#FFF7ED] px-4 py-3 text-sm text-[#1E293B] placeholder-slate-400 border border-orange-200 focus:border-[#F97316] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || Boolean(isCooldown)}
              className="mt-4 w-full rounded-xl bg-[#F97316] py-3.5 text-sm font-bold text-white hover:bg-[#EA580C] transition disabled:opacity-50 shadow-lg shadow-orange-500/20"
            >
              {submitting ? "Allocating Table..." : "Find Table"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
