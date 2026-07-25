/**
 * useRBAC — thin hook for client-side role/permission checks.
 *
 * This hook queries the backend /api/v1/auth/users/me/roles endpoint
 * and exposes helpers for checking roles and permissions in components.
 *
 * Usage:
 *   const { hasRole, hasPermission, roles, isLoading } = useRBAC();
 *   if (hasRole("admin")) { ... }
 *   if (hasPermission("menu:edit")) { ... }
 */
"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions: Permission[];
}

interface UserRolesResponse {
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

export function useRBAC() {
  const { getToken, isSignedIn } = useAuth();

  const { data, isLoading, isError } = useQuery<UserRolesResponse>({
    queryKey: ["me", "roles"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      return fetchMyRoles(token);
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const isSuperadmin = data?.is_superadmin ?? false;
  const roles = data?.roles ?? [];

  const roleCodes = new Set(roles.map((r) => r.code));
  const permissionCodes = new Set(
    roles.flatMap((r) => r.permissions.map((p) => p.code))
  );

  return {
    /** True if roles/permissions are still loading */
    isLoading,
    /** True if the roles request failed */
    isError,
    /** The raw roles array from the backend */
    roles,
    /** True if the user has the superadmin flag */
    isSuperadmin,
    /**
     * Returns true if the user has at least one of the specified role codes.
     * Superadmin always returns true.
     */
    hasRole: (...codes: string[]) =>
      isSuperadmin || codes.some((c) => roleCodes.has(c)),
    /**
     * Returns true if the user has the specified permission code.
     * Superadmin always returns true.
     */
    hasPermission: (code: string) =>
      isSuperadmin || permissionCodes.has(code),
  };
}
