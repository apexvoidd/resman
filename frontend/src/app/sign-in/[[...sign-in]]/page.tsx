import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staff Login — Smart Restaurant OS",
  description: "Secure Staff & Executive Sign-In Portal",
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center space-y-2 mb-6 text-center z-10">
        <div className="text-3xl p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          🍽️
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          ResMan Enterprise OS
        </h1>
        <p className="text-xs sm:text-sm text-sky-400 font-semibold">
          Official Staff & Management Sign-In Portal
        </p>
      </div>

      <div className="w-full max-w-4xl z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Styled High-Contrast Sign-In Card Container (FIRST ON MOBILE) */}
        <div className="order-1 md:order-2 bg-slate-900 border border-slate-800 rounded-3xl p-2 sm:p-4 shadow-2xl backdrop-blur-xl">
          <SignIn
            fallbackRedirectUrl="/redirect"
            forceRedirectUrl="/redirect"
            appearance={{
              elements: {
                card: "bg-slate-900 border-none shadow-none text-slate-100 p-4 sm:p-6",
                headerTitle: "text-xl font-extrabold text-white",
                headerSubtitle: "text-xs font-medium text-slate-400",
                socialButtonsBlockButton:
                  "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl transition",
                formButtonPrimary:
                  "bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20",
                formFieldLabel: "text-xs font-bold text-slate-300",
                formFieldInput:
                  "bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition px-3.5 py-2.5",
                footerAction: "hidden",
                footerActionLink: "hidden",
                footerActionText: "hidden",
                footer: "hidden",
                dividerLine: "bg-slate-800",
                dividerText: "text-xs text-slate-400 font-semibold bg-slate-900 px-2",
                identityPreviewText: "text-xs text-slate-200 font-semibold",
                identityPreviewEditButtonIcon: "text-sky-400",
              },
            }}
          />
        </div>

        {/* Hackathon Judge Quick Credentials Banner (SECOND ON MOBILE) */}
        <div className="order-2 md:order-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <span className="text-lg">🏆</span>
            <div>
              <h3 className="text-sm font-bold text-white">Hackathon Demo Credentials</h3>
              <p className="text-[11px] text-slate-400">Sign in with Email & Password or Google</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center font-bold text-sky-400">
                <span>👔 Manager / Admin</span>
                <span className="text-[10px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">Full Control</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">admin@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">Password: <code className="text-slate-200">Hackathon2026!</code></p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center font-bold text-emerald-400">
                <span>💵 Cashier</span>
                <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">POS & Bills</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">cashier@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">Password: <code className="text-slate-200">Hackathon2026!</code></p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center font-bold text-amber-400">
                <span>📋 Waiter / 🍳 Kitchen</span>
                <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Orders & KDS</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">kitchen@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">Password: <code className="text-slate-200">Hackathon2026!</code></p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500">Customer Entrance?</span>
            <Link href="/join" className="text-sky-400 font-semibold hover:underline">
              Enter Customer Portal ➔
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
