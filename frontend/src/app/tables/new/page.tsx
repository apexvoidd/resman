"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRBAC } from "@/hooks/use-rbac";
import { createTable } from "@/services/table";
import {
  tableCreateSchema,
  TableCreateFormValues,
} from "@/lib/validations/table";
import Link from "next/link";
import {
  Plus,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldAlert,
  UtensilsCrossed,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";

export default function AddTablePage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const canManage = hasRole("admin", "manager");
  const router = useRouter();
  const toast = useToast();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TableCreateFormValues>({
    resolver: zodResolver(tableCreateSchema),
    defaultValues: {
      table_number: "",
      capacity: 4,
      status: "available",
      description: "",
      is_active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: TableCreateFormValues) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return createTable(token, values);
    },
    onSuccess: (table) => {
      toast.success(`Dining Table '${table.table_number}' created successfully!`, "Table Created");
      router.push("/tables");
    },
    onError: (err: Error) => {
      const msg = err.message || "Failed to create dining table.";
      setErrorMsg(msg);
      toast.error(msg, "Creation Failed");
    },
  });

  const onSubmit = (values: TableCreateFormValues) => {
    setErrorMsg(null);
    createMutation.mutate(values);
  };

  if (!isAuthLoaded || isRbacLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          Loading permissions...
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Access Restricted</h1>
          <p className="text-sm text-slate-400">
            Only <strong className="text-orange-400">Admin</strong> and{" "}
            <strong className="text-orange-400">Manager</strong> roles can add dining tables.
          </p>
          <Link
            href="/tables"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tables Layout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5">
          <Link
            href="/tables"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tables Layout
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
            <Plus className="w-7 h-7 text-orange-500" /> Add New Dining Table
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure table identifiers, seat capacity, status, and physical location description.
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-orange-400" /> Table Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Table Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  {...register("table_number")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. T-01 or Table 1"
                />
                {errors.table_number && (
                  <p className="text-xs text-rose-400 mt-1">{errors.table_number.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Capacity (Seats) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  {...register("capacity", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. 4"
                />
                {errors.capacity && (
                  <p className="text-xs text-rose-400 mt-1">{errors.capacity.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Operational Status <span className="text-rose-400">*</span>
                </label>
                <select
                  {...register("status")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="occupied">Occupied</option>
                  <option value="billing">Billing</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
                {errors.status && (
                  <p className="text-xs text-rose-400 mt-1">{errors.status.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Location / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  {...register("description")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. Window side table, Main Hall section"
                />
                {errors.description && (
                  <p className="text-xs text-rose-400 mt-1">{errors.description.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Active Toggle */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Table Availability State</h3>
              <p className="text-xs text-slate-400">
                Enabled tables can accept reservations and guest seating.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                {...register("is_active")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/tables"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              {(isSubmitting || createMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Create Dining Table
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
