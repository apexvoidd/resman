"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRBAC } from "@/hooks/use-rbac";
import {
  fetchSettings,
  updateSettings,
  RestaurantSettings,
} from "@/services/settings";
import {
  settingsSchema,
  SettingsFormValues,
} from "@/lib/validations/settings";
import Link from "next/link";
import {
  Building2,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Power,
  Store,
} from "lucide-react";

function SettingsPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const canEdit = isAdmin || isManager;
  const queryClient = useQueryClient();

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const {
    data: settings,
    isLoading: isSettingsLoading,
    isError,
    error,
  } = useQuery<RestaurantSettings>({
    queryKey: ["restaurant-settings"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return fetchSettings(token);
    },
    enabled: !!isSignedIn,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      gst_number: "",
      is_closed: false,
      tax_percentage: 5,
      service_charge_percentage: 0,
      opening_time: "09:00",
      closing_time: "22:00",
    },
  });

  const isClosedValue = watch("is_closed");

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        gst_number: settings.gst_number || "",
        is_closed: settings.is_closed ?? false,
        tax_percentage: settings.tax_percentage ?? 5,
        service_charge_percentage: settings.service_charge_percentage ?? 0,
        opening_time: settings.opening_time || "",
        closing_time: settings.closing_time || "",
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return updateSettings(token, values);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["restaurant-settings"], updated);
      setMessage({
        type: "success",
        text: "Restaurant settings saved successfully!",
      });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err: Error) => {
      setMessage({
        type: "error",
        text: err.message || "Failed to update settings.",
      });
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    setMessage(null);
    updateMutation.mutate(values);
  };

  const handleToggleClosed = async (closed: boolean) => {
    setValue("is_closed", closed, { shouldDirty: true });
    if (canEdit) {
      try {
        const token = await getToken();
        if (!token) return;
        const updated = await updateSettings(token, { is_closed: closed });
        queryClient.setQueryData(["restaurant-settings"], updated);
        setMessage({
          type: "success",
          text: closed
            ? "Restaurant is now CLOSED for bookings and orders."
            : "Restaurant is now OPEN for business!",
        });
        setTimeout(() => setMessage(null), 5000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to toggle status";
        setMessage({ type: "error", text: msg });
      }
    }
  };

  if (!isAuthLoaded || isRbacLoading || isSettingsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          Loading restaurant settings...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
              Restaurant Settings
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure restaurant details, financial parameters, business hours, and operational status.
            </p>
          </div>
          {canEdit ? (
            <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold rounded-full">
              {isAdmin ? "Admin Access" : "Manager Access"}
            </span>
          ) : (
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold rounded-full">
              Read Only
            </span>
          )}
        </div>

        {/* Access Warning Banner for Non-Admins/Managers */}
        {!canEdit && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-300">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold block">Read-Only View</span>
              You are currently viewing settings in read-only mode. Only Admin or Manager accounts can update settings.
            </div>
          </div>
        )}

        {/* System Message Banner */}
        {message && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            {message.text}
          </div>
        )}

        {isError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            Failed to load settings: {(error as Error).message}
          </div>
        )}

        {/* Section 0: Close / Open Restaurant Toggle */}
        <div
          className={`p-5 sm:p-6 rounded-2xl border transition-all ${
            isClosedValue
              ? "bg-rose-950/30 border-rose-800/60"
              : "bg-emerald-950/30 border-emerald-800/60"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl border ${
                  isClosedValue
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                }`}
              >
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-100">
                    Restaurant Operating Status
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                      isClosedValue
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {isClosedValue ? "● CLOSED" : "● OPEN"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isClosedValue
                    ? "The restaurant is currently CLOSED. Guests cannot book tables or place orders."
                    : "The restaurant is OPEN for table bookings, queueing, and menu ordering."}
                </p>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => handleToggleClosed(!isClosedValue)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md ${
                  isClosedValue
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                }`}
              >
                <Power className="w-4 h-4" />
                {isClosedValue ? "Open Restaurant" : "Close Restaurant"}
              </button>
            )}
          </div>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section 1: General Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2 text-orange-400 font-semibold border-b border-slate-800 pb-3">
              <Building2 className="w-5 h-5" />
              <h2>Restaurant Profile</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Restaurant Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  {...register("name")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. Gourmet Bistro"
                />
                {errors.name && (
                  <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  {...register("phone")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. +91 9876543210"
                />
                {errors.phone && (
                  <p className="text-xs text-rose-400 mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled={!canEdit}
                  {...register("email")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. contact@gourmetbistro.com"
                />
                {errors.email && (
                  <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GST / Tax Registration Number
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  {...register("gst_number")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                />
                {errors.gst_number && (
                  <p className="text-xs text-rose-400 mt-1">{errors.gst_number.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Physical Address
                </label>
                <textarea
                  rows={2}
                  disabled={!canEdit}
                  {...register("address")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 123 Culinary Avenue, Foodville"
                />
                {errors.address && (
                  <p className="text-xs text-rose-400 mt-1">{errors.address.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Financial & Taxes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2 text-orange-400 font-semibold border-b border-slate-800 pb-3">
              <Coins className="w-5 h-5" />
              <h2>Financial & Billing Settings</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GST Tax Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  {...register("tax_percentage", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 5.0"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Connected directly to order totals and billing calculation.
                </p>
                {errors.tax_percentage && (
                  <p className="text-xs text-rose-400 mt-1">{errors.tax_percentage.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Service Charge Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  {...register("service_charge_percentage", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 10.0"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Connected to final bill sub-total additions.
                </p>
                {errors.service_charge_percentage && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.service_charge_percentage.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Business Hours (Beta) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-orange-400 font-semibold">
                <Clock className="w-5 h-5" />
                <h2>Business Hours (Beta)</h2>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-full uppercase">
                Beta Feature
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Set standard operating hours for display purposes. Automatic auto-close logic will be enabled in a future release.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Opening Time (HH:MM 24h)
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  {...register("opening_time")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                />
                {errors.opening_time && (
                  <p className="text-xs text-rose-400 mt-1">{errors.opening_time.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Closing Time (HH:MM 24h)
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  {...register("closing_time")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                />
                {errors.closing_time && (
                  <p className="text-xs text-rose-400 mt-1">{errors.closing_time.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => settings && reset()}
                disabled={!isDirty || isSubmitting}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Reset Changes
              </button>
              <button
                type="submit"
                disabled={isSubmitting || updateMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
              >
                {(isSubmitting || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save Settings
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function SettingsPageWrapper() {
  return (
    <RouteGuard roles={["manager", "admin"]}>
      <SettingsPage />
    </RouteGuard>
  );
}
