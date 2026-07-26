"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRBAC } from "@/hooks/use-rbac";
import { fetchRoles, createStaff } from "@/services/staff";
import {
  staffCreateSchema,
  StaffCreateFormValues,
} from "@/lib/validations/staff";
import Link from "next/link";
import {
  UserPlus,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Shield,
} from "lucide-react";

export default function AddStaffPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const isAdmin = hasRole("admin");
  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch roles for selection
  const { data: roles = [], isLoading: isRolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return fetchRoles(token);
    },
    enabled: !!isSignedIn && isAdmin,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffCreateFormValues>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role_codes: [],
      is_active: true,
    },
  });

  const selectedRoles = watch("role_codes") || [];

  const createMutation = useMutation({
    mutationFn: async (values: StaffCreateFormValues) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return createStaff(token, values);
    },
    onSuccess: () => {
      router.push("/staff");
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Failed to create staff member.");
    },
  });

  const handleRoleToggle = (code: string) => {
    if (selectedRoles.includes(code)) {
      setValue(
        "role_codes",
        selectedRoles.filter((c) => c !== code),
        { shouldValidate: true }
      );
    } else {
      setValue("role_codes", [...selectedRoles, code], {
        shouldValidate: true,
      });
    }
  };

  const onSubmit = (values: StaffCreateFormValues) => {
    setErrorMsg(null);
    createMutation.mutate(values);
  };

  if (!isAuthLoaded || isRbacLoading || isRolesLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          Loading form options...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Access Restricted</h1>
          <p className="text-sm text-slate-400">
            Only users with the <strong className="text-orange-400">Admin</strong> role can add staff members.
          </p>
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Staff Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5">
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Staff Directory
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
            <UserPlus className="w-7 h-7 text-orange-500" /> Add New Staff Member
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create an employee profile and assign system roles and permissions.
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
            <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800 pb-3">
              Personal & Contact Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  First Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  {...register("first_name")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. John"
                />
                {errors.first_name && (
                  <p className="text-xs text-rose-400 mt-1">{errors.first_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Last Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  {...register("last_name")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. Doe"
                />
                {errors.last_name && (
                  <p className="text-xs text-rose-400 mt-1">{errors.last_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. staff.member@gmail.com"
                />
                <p className="text-[11px] text-sky-400 mt-1 font-medium">
                  💡 Use the valid email address (or Gmail) that the staff member uses to sign in. Their Clerk login will automatically inherit the assigned roles upon sign-in.
                </p>
                {errors.email && (
                  <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  {...register("phone")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="e.g. +91 9876543210"
                />
                {errors.phone && (
                  <p className="text-xs text-rose-400 mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Login Password (for Password Sign-In)
                </label>
                <input
                  type="password"
                  {...register("password")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  placeholder="Set initial staff login password"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Allows direct Email + Password sign-in at <code>/sign-in</code> without OTP.
                </p>
                {errors.password && (
                  <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Roles Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-200">
                Assign System Roles <span className="text-rose-400">*</span>
              </h2>
              <p className="text-xs text-slate-400">
                Select one or more roles defining this employee&apos;s permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {roles.map((role) => {
                const isSelected = selectedRoles.includes(role.code);
                return (
                  <button
                    type="button"
                    key={role.code}
                    onClick={() => handleRoleToggle(role.code)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      isSelected
                        ? "bg-orange-500/10 border-orange-500/50 text-slate-100 shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "border-slate-700"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-200 block">
                        {role.name}
                      </span>
                      {role.description && (
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          {role.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.role_codes && (
              <p className="text-xs text-rose-400">{errors.role_codes.message}</p>
            )}
          </div>

          {/* Section: Account Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Account Status</h3>
              <p className="text-xs text-slate-400">
                Active staff members can log in and perform authorized duties.
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
              href="/staff"
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
              Create Staff Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
