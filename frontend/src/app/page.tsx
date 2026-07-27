import { HomeStaffHeaderAction } from "@/components/HomeStaffRedirect";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col justify-between p-4 sm:p-8 lg:p-10 border-t-4 border-[#2563EB]">
      {/* Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 w-full max-w-6xl mx-auto">
        <div className="flex items-center space-x-2.5">
          <span className="text-xl sm:text-2xl">🍽️</span>
          <span className="text-sm sm:text-base font-bold text-[#F8FAFC] tracking-tight">
            ResMan Enterprise OS
          </span>
        </div>

        <div className="shrink-0">
          <HomeStaffHeaderAction />
        </div>
      </header>

      {/* Main Hero Card */}
      <section className="w-full max-w-3xl mx-auto my-auto py-8 sm:py-12 flex flex-col items-center text-center space-y-6 sm:space-y-8 bg-[#1E293B] border border-[#334155] rounded-2xl p-5 sm:p-10 lg:p-12 shadow-2xl">
        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-2xl sm:text-3xl shadow-sm">
          🍽️
        </div>

        <div className="space-y-3 max-w-xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F8FAFC] leading-tight">
            Smart Restaurant Management System
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] font-normal leading-relaxed">
            Enterprise Operating System for Guest QR Ordering, Kitchen Display Systems, Cashier Settlements, & Inventory Control.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/join"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-[#2563EB]/25 active:scale-[0.98]"
          >
            <span>📱 Enter Customer Portal</span>
            <span>➔</span>
          </Link>
          <Link
            href="/sign-in"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#0F172A] hover:bg-[#334155] border border-[#334155] text-[#CBD5E1] hover:text-white font-semibold text-xs sm:text-sm transition active:scale-[0.98]"
          >
            <span>🔑 Staff Sign-In</span>
            <span>➔</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-center sm:text-left text-[11px] text-[#94A3B8] border-t border-[#334155] pt-6 gap-3">
        <p>© 2026 Smart Restaurant Management System. All rights reserved.</p>
        <div className="flex items-center space-x-4">
          <Link href="/join" className="hover:text-[#F8FAFC] transition">Customer Entrance</Link>
          <Link href="/sign-in" className="hover:text-[#F8FAFC] transition">Staff Portal</Link>
        </div>
      </footer>
    </main>
  );
}
