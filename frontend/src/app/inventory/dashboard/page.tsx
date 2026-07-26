"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventoryDashboardAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/inventory");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
      <div className="flex items-center space-x-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
        <p className="text-sm font-semibold">Redirecting to Inventory Control...</p>
      </div>
    </div>
  );
}
