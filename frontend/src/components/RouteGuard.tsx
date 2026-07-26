"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RouteGuardProps {
  roles?: string[];
  permission?: string;
  children: React.ReactNode;
}

export function RouteGuard({ roles, permission, children }: RouteGuardProps) {
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { hasRole, hasPermission, isLoading: isRbacLoading } = useRBAC();
  const router = useRouter();

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
        router.replace("/unauthorized");
      }
    }
  }, [isChecking, isSignedIn, isAuthorized, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-xs text-gray-400 font-medium">Verifying security & permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
