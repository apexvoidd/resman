"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export function HomeStaffHeaderAction() {
  const { isSignedIn, isLoaded } = useAuth();
  const { designatedDashboard } = useRBAC();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <div className="flex items-center space-x-3 bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg shadow-sm">
        <UserButton />
        <Link
          href={designatedDashboard || "/redirect"}
          className="text-xs font-semibold text-sky-400 hover:underline transition flex items-center space-x-1"
        >
          <span>Open Workspace</span>
          <span>➔</span>
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/sign-in"
      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition shadow-sm"
    >
      Office / Staff Login ➔
    </Link>
  );
}
