"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SmartRedirectPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isRbacLoading, designatedDashboard } = useRBAC();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    } else if (isLoaded && !isRbacLoading) {
      router.replace(designatedDashboard);
    }
  }, [isLoaded, isSignedIn, isRbacLoading, designatedDashboard, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
      <div className="flex flex-col items-center space-y-4 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        <div className="h-12 w-12 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-slate-100">Directing to your workspace...</h2>
          <p className="text-xs text-slate-400">Verifying role permissions & loading designated dashboard.</p>
        </div>
      </div>
    </div>
  );
}
