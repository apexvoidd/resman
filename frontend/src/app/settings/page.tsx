"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect, ChangeEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRBAC } from "@/hooks/use-rbac";
import {
  fetchSettings,
  updateSettings,
  uploadLogo,
  RestaurantSettings,
} from "@/services/settings";
import { getSafeImageUrl } from "@/lib/utils";
import {
  settingsSchema,
  SettingsFormValues,
} from "@/lib/validations/settings";
import Link from "next/link";
import {
  Building2,
  Clock,
  Coins,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  Loader2,
} from "lucide-react";

function SettingsPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);

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
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      gst_number: "",
      currency: "INR",
      timezone: "Asia/Kolkata",
      tax_percentage: 0,
      service_charge_percentage: 0,
      reservation_timeout_minutes: 15,
      queue_timeout_minutes: 30,
      opening_time: "09:00",
      closing_time: "22:00",
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        gst_number: settings.gst_number || "",
        currency: settings.currency || "INR",
        timezone: settings.timezone || "Asia/Kolkata",
        tax_percentage: settings.tax_percentage ?? 0,
        service_charge_percentage: settings.service_charge_percentage ?? 0,
        reservation_timeout_minutes: settings.reservation_timeout_minutes ?? 15,
        queue_timeout_minutes: settings.queue_timeout_minutes ?? 30,
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

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");

      await uploadLogo(token, file);
      queryClient.invalidateQueries({ queryKey: ["restaurant-settings"] });
      setMessage({
        type: "success",
        text: "Restaurant logo updated successfully!",
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to upload logo";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSubmit = (values: SettingsFormValues) => {
    setMessage(null);
    updateMutation.mutate(values);
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
              Configure profile, operations, financial parameters, and working hours.
            </p>
          </div>
          {isAdmin ? (
            <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold rounded-full">
              Admin Access
            </span>
          ) : (
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold rounded-full">
              Read Only
            </span>
          )}
        </div>

        {/* Access Warning Banner for Non-Admins */}
        {!isAdmin && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-300">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold block">Read-Only View</span>
              You are currently viewing settings in read-only mode. Only users with the{" "}
              <strong className="underline">Admin</strong> role can modify restaurant configurations.
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

        {/* Main Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section 1: Logo & General Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2 text-orange-400 font-semibold border-b border-slate-800 pb-3">
              <Building2 className="w-5 h-5" />
              <h2>General Information & Logo</h2>
            </div>

            {/* Logo display & upload */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <div className="w-24 h-24 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {getSafeImageUrl(settings?.logo_url) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getSafeImageUrl(settings?.logo_url)!}
                    alt="Restaurant Logo"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                      if (e.currentTarget.parentElement) {
                        const fallback = document.createElement("span");
                        fallback.className = "text-3xl";
                        fallback.innerText = "🍽️";
                        e.currentTarget.parentElement.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <span className="text-3xl">🍽️</span>
                )}
              </div>
              <div className="space-y-2 text-center sm:text-left flex-1">
                <h3 className="text-sm font-semibold text-slate-200">
                  Restaurant Logo
                </h3>
                <p className="text-xs text-slate-400">
                  Upload a PNG, JPEG, WebP, or GIF image (Max size: 5MB). Uploaded directly to Cloudflare R2.
                </p>
                {isAdmin && (
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-700">
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                    ) : (
                      <Upload className="w-4 h-4 text-orange-400" />
                    )}
                    {uploadingLogo ? "Uploading..." : "Upload New Logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Restaurant Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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

          {/* Section 2: Financial & Locale */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2 text-orange-400 font-semibold border-b border-slate-800 pb-3">
              <Coins className="w-5 h-5" />
              <h2>Financial & Localization Settings</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Currency <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  {...register("currency")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="INR / USD / EUR"
                />
                {errors.currency && (
                  <p className="text-xs text-rose-400 mt-1">{errors.currency.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Timezone <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  {...register("timezone")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="Asia/Kolkata / UTC"
                />
                {errors.timezone && (
                  <p className="text-xs text-rose-400 mt-1">{errors.timezone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tax Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...register("tax_percentage", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 5.0"
                />
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
                  disabled={!isAdmin}
                  {...register("service_charge_percentage", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 10.0"
                />
                {errors.service_charge_percentage && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.service_charge_percentage.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Operations & Hours */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2 text-orange-400 font-semibold border-b border-slate-800 pb-3">
              <Clock className="w-5 h-5" />
              <h2>Operations & Working Hours</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reservation Timeout (Minutes)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  {...register("reservation_timeout_minutes", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 15"
                />
                {errors.reservation_timeout_minutes && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.reservation_timeout_minutes.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Queue Timeout (Minutes)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  {...register("queue_timeout_minutes", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  placeholder="e.g. 30"
                />
                {errors.queue_timeout_minutes && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.queue_timeout_minutes.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Opening Time (HH:MM 24h)
                </label>
                <input
                  type="time"
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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
          {isAdmin && (
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
