/**
 * useRBAC — thin hook for client-side role/permission checks and designated landing routing.
 *
 * This hook queries the backend /api/v1/auth/users/me/roles endpoint
 * and exposes helpers for checking roles, permissions, and designated dashboard routes.
 */
"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions: Permission[];
}

export interface UserRolesResponse {
  user_id: string;
  is_superadmin: boolean;
  roles: Role[];
}

async function fetchMyRoles(token: string): Promise<UserRolesResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${apiUrl}/api/v1/auth/users/me/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user roles");
  return res.json();
}

/**
 * Returns the designated landing dashboard URL for a given set of roles.
 */
export function getDesignatedDashboard(roles: Role[], isSuperadmin: boolean): string {
  if (isSuperadmin) return "/manager/dashboard";

  const roleCodes = new Set(roles.map((r) => r.code.toLowerCase()));

  if (roleCodes.has("admin") || roleCodes.has("manager")) {
    return "/manager/dashboard";
  }
  if (roleCodes.has("waiter")) {
    return "/waiter/dashboard";
  }
  if (roleCodes.has("kitchen") || roleCodes.has("kitchen_staff") || roleCodes.has("chef")) {
    return "/kitchen/dashboard";
  }
  if (roleCodes.has("cashier")) {
    return "/cashier";
  }
  if (roleCodes.has("cleaning_staff") || roleCodes.has("cleaner") || roleCodes.has("housekeeping")) {
    return "/cleaning/dashboard";
  }

  // Default fallback if user has no matching staff role
  return "/manager/dashboard";
}

export function useRBAC() {
  const { userId, getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(userId);

  // Clear query cache when user account changes or signs out
  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      queryClient.clear();
    }
    prevUserIdRef.current = userId;
  }, [userId, queryClient]);

  const { data, isLoading, isError } = useQuery<UserRolesResponse>({
    queryKey: ["me", "roles", userId ?? "anonymous"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      return fetchMyRoles(token);
    },
    enabled: !!isSignedIn && !!userId,
    staleTime: 10 * 1000, // 10 seconds per user session
    gcTime: 0, // do not persist stale user roles across session switches
  });

  const isSuperadmin = data?.is_superadmin ?? false;
  const roles = data?.roles ?? [];

  const roleCodes = new Set(roles.map((r) => r.code.toLowerCase()));
  const permissionCodes = new Set(
    roles.flatMap((r) => r.permissions.map((p) => p.code.toLowerCase()))
  );

  const designatedDashboard = getDesignatedDashboard(roles, isSuperadmin);

  return {
    /** True if roles/permissions are still loading */
    isLoading,
    /** True if the roles request failed */
    isError,
    /** The raw roles array from the backend */
    roles,
    /** True if the user has the superadmin flag */
    isSuperadmin,
    /** Designated dashboard for the user's primary role */
    designatedDashboard,
    /**
     * Returns true if the user has at least one of the specified role codes.
     * Superadmin always returns true.
     */
    hasRole: (...codes: string[]) => {
      if (isSuperadmin) return true;
      return codes.some((c) => roleCodes.has(c.toLowerCase()));
    },
    /**
     * Returns true if the user has the specified permission code.
     * Superadmin always returns true.
     */
    hasPermission: (code: string) => {
      if (isSuperadmin) return true;
      return permissionCodes.has(code.toLowerCase());
    },
  };
}
