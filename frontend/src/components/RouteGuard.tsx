"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

interface RouteGuardProps {
  roles?: string[];
  permission?: string;
  children: React.ReactNode;
}

export function RouteGuard({ roles, permission, children }: RouteGuardProps) {
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { hasRole, hasPermission, isLoading: isRbacLoading, designatedDashboard } = useRBAC();
  const router = useRouter();
  const pathname = usePathname();

  const isChecking = !isAuthLoaded || isRbacLoading;

  const isAuthorized = (() => {
    if (!isSignedIn) return false;
    if (roles && roles.length > 0) {
      if (hasRole(...roles)) return true;
    }
    if (permission) {
      if (hasPermission(permission)) return true;
    }
    if (!roles && !permission) return true;
    return false;
  })();

  useEffect(() => {
    if (!isChecking) {
      if (!isSignedIn) {
        router.replace("/sign-in");
      } else if (!isAuthorized) {
        // Redirect unauthorized staff directly to their designated dashboard
        if (designatedDashboard && pathname !== designatedDashboard) {
          router.replace(designatedDashboard);
        } else {
          router.replace("/unauthorized");
        }
      }
    }
  }, [isChecking, isSignedIn, isAuthorized, router, designatedDashboard, pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="text-xs text-slate-400 font-medium">Verifying security & permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
