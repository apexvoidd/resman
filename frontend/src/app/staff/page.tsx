"use client";

import { RouteGuard } from "@/components/RouteGuard";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRBAC } from "@/hooks/use-rbac";
import {
  fetchStaffList,
  fetchRoles,
  toggleStaffStatus,
  deleteStaff,
  StaffMember,
} from "@/services/staff";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Shield,
} from "lucide-react";

function StaffListPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasRole, isLoading: isRbacLoading } = useRBAC();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Delete Modal State
  const [deletingMember, setDeletingMember] = useState<StaffMember | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch available roles for filter dropdown
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return fetchRoles(token);
    },
    enabled: !!isSignedIn && isAdmin,
  });

  // Fetch paginated staff list
  const {
    data: staffData,
    isLoading: isStaffLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["staff-list", search, roleFilter, statusFilter, page],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return fetchStaffList(token, {
        search: search || undefined,
        role: roleFilter || undefined,
        is_active:
          statusFilter === "active"
            ? true
            : statusFilter === "inactive"
            ? false
            : undefined,
        page,
        page_size: pageSize,
      });
    },
    enabled: !!isSignedIn && isAdmin,
    refetchInterval: 3000,
  });

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return toggleStaffStatus(token, id, is_active);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["staff-list"] });
      setNotification({
        type: "success",
        text: `Staff member '${updated.first_name} ${updated.last_name}' status updated.`,
      });
      setTimeout(() => setNotification(null), 4000);
    },
    onError: (err: Error) => {
      setNotification({
        type: "error",
        text: err.message || "Failed to update staff status.",
      });
    },
  });

  // Delete staff mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated");
      return deleteStaff(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-list"] });
      setDeletingMember(null);
      setNotification({
        type: "success",
        text: "Staff member deleted successfully.",
      });
      setTimeout(() => setNotification(null), 4000);
    },
    onError: (err: Error) => {
      setDeletingMember(null);
      setNotification({
        type: "error",
        text: err.message || "Failed to delete staff member.",
      });
    },
  });

  if (!isAuthLoaded || isRbacLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          Authenticating access...
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
            Only users with the <strong className="text-orange-400">Admin</strong> role have permission to manage restaurant staff members.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
              <Users className="w-7 h-7 text-orange-500" /> Staff Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage restaurant employees, assign roles, and configure access statuses.
            </p>
          </div>

          <Link
            href="/staff/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </Link>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            {notification.text}
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search by Name or Email */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search staff by name or email..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-3 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 appearance-none"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {isStaffLoading ? (
            <div className="p-12 flex items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              Loading staff directory...
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-rose-400 space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto" />
              <p>Failed to load staff list: {(error as Error).message}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : staffData?.items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-base font-medium text-slate-300">
                No staff members found
              </p>
              <p className="text-xs text-slate-500">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Roles</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {staffData?.items.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Name & Initials */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 block">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              ID: {member.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {member.email}
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              {member.phone}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {member.roles.length > 0 ? (
                            member.roles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                <Shield className="w-3 h-3 text-orange-400" />
                                {r.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">No roles assigned</span>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() =>
                            toggleMutation.mutate({
                              id: member.id,
                              is_active: !member.is_active,
                            })
                          }
                          disabled={toggleMutation.isPending}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            member.is_active
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {member.is_active ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-500" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/staff/${member.id}/edit`}
                            className="p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Staff"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setDeletingMember(member)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {staffData && staffData.total_pages > 1 && (
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing Page <strong>{staffData.page}</strong> of{" "}
                <strong>{staffData.total_pages}</strong> ({staffData.total} total staff)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(staffData.total_pages, p + 1))}
                  disabled={page >= staffData.total_pages}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Delete Staff Member?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete{" "}
                <strong className="text-slate-200">
                  {deletingMember.first_name} {deletingMember.last_name}
                </strong>{" "}
                ({deletingMember.email})? This action will soft-delete their account and revoke system access.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingMember(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingMember.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPageWrapper() {
  return (
    <RouteGuard permission="staff:view">
      <StaffListPage />
    </RouteGuard>
  );
}
