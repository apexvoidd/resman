import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col justify-between p-6 sm:p-10 border-t-4 border-[#2563EB]">
      {/* Header Bar */}
      <header className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center space-x-2.5">
          <span className="text-2xl">🍽️</span>
          <span className="text-base font-bold text-[#F8FAFC] tracking-tight">
            ResMan Enterprise OS
          </span>
        </div>

        <div>
          {userId ? (
            <div className="flex items-center space-x-3 bg-[#1E293B] border border-[#334155] px-3.5 py-1.5 rounded-lg shadow-sm">
              <UserButton />
              <Link
                href="/manager/dashboard"
                className="text-xs font-semibold text-[#2563EB] hover:underline transition"
              >
                Manager Hub ➔
              </Link>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-lg bg-[#334155] hover:bg-[#475569] border border-[#475569] text-xs font-semibold text-[#F8FAFC] transition shadow-sm"
            >
              Office / Staff Login ➔
            </Link>
          )}
        </div>
      </header>

      {/* Main Hero Card */}
      <section className="w-full max-w-3xl mx-auto my-auto py-12 flex flex-col items-center text-center space-y-8 bg-[#1E293B] border border-[#334155] rounded-2xl p-8 sm:p-12 shadow-2xl">
        <div className="h-16 w-16 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-3xl">
          🍽️
        </div>

        <div className="space-y-3 max-w-xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F8FAFC]">
            Smart Restaurant Management System
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] font-normal leading-relaxed">
            Enterprise Operating System for Guest QR Ordering, Kitchen Display Systems, Cashier Settlements, & Inventory Control.
          </p>
        </div>

        {/* Primary Action Button: #2563EB -> #1D4ED8 */}
        <div className="pt-2">
          <Link
            href="/join"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition shadow-md shadow-[#2563EB]/20"
          >
            <span>📱 Enter Customer Portal</span>
            <span>➔</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#94A3B8] border-t border-[#334155] pt-6 gap-2">
        <p>© 2026 Smart Restaurant Management System. All rights reserved.</p>
        <div className="flex items-center space-x-4">
          <Link href="/join" className="hover:text-[#F8FAFC] transition">Customer Entrance</Link>
          <Link href="/sign-in" className="hover:text-[#F8FAFC] transition">Staff Portal</Link>
        </div>
      </footer>
    </main>
  );
}
