"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "demo">("signin");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 text-slate-100 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center space-y-1.5 mb-4 sm:mb-6 text-center z-10">
        <div className="text-2xl sm:text-3xl p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          🍽️
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
          ResMan Enterprise OS
        </h1>
        <p className="text-xs sm:text-sm text-sky-400 font-semibold">
          Official Staff & Executive Sign-In Portal
        </p>
      </div>

      {/* Mobile Tab Switcher (< md) */}
      <div className="w-full max-w-md mb-4 flex md:hidden bg-slate-900 p-1 rounded-2xl border border-slate-800 z-10 text-xs font-bold">
        <button
          onClick={() => setActiveTab("signin")}
          className={`flex-1 py-2.5 rounded-xl text-center transition ${
            activeTab === "signin"
              ? "bg-sky-600 text-white shadow-lg"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🔑 Sign In Form
        </button>
        <button
          onClick={() => setActiveTab("demo")}
          className={`flex-1 py-2.5 rounded-xl text-center transition ${
            activeTab === "demo"
              ? "bg-sky-600 text-white shadow-lg"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🏆 Demo Accounts
        </button>
      </div>

      {/* Quick Demo Helper Ribbon (Always visible on mobile above form) */}
      <div className="w-full max-w-4xl mb-4 md:hidden z-10 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>💡</span>
          <span className="font-semibold text-[11px]">
            Demo Password: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-white font-mono">Hackathon2026!</code>
          </span>
        </div>
        <button
          onClick={() => setActiveTab(activeTab === "signin" ? "demo" : "signin")}
          className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 px-2.5 py-1 rounded-lg text-amber-200 border border-amber-500/30"
        >
          {activeTab === "signin" ? "View Accounts ➔" : "Go to Form ➔"}
        </button>
      </div>

      <div className="w-full max-w-4xl z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Hackathon Judge Quick Credentials Banner */}
        <div
          className={`${
            activeTab === "demo" ? "block" : "hidden md:block"
          } bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🏆</span>
              <div>
                <h3 className="text-sm font-bold text-white">Hackathon Demo Credentials</h3>
                <p className="text-[11px] text-slate-400">Tap email to copy instantly</p>
              </div>
            </div>
            {copiedText && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                ✓ {copiedText} Copied!
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs max-h-[380px] overflow-y-auto pr-1">
            {/* Admin */}
            <div
              onClick={() => copyToClipboard("admin@restaurant.com", "Admin Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-sky-400">
                <span className="flex items-center gap-1.5">
                  <span>👑 Admin</span>
                </span>
                <span className="text-[10px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 group-hover:bg-sky-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">admin@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>

            {/* Manager */}
            <div
              onClick={() => copyToClipboard("manager@restaurant.com", "Manager Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-indigo-400">
                <span className="flex items-center gap-1.5">
                  <span>👔 Manager</span>
                </span>
                <span className="text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 group-hover:bg-indigo-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">manager@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>

            {/* Waiter */}
            <div
              onClick={() => copyToClipboard("waiter@restaurant.com", "Waiter Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <span>🛎️ Waiter</span>
                </span>
                <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 group-hover:bg-amber-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">waiter@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>

            {/* Kitchen */}
            <div
              onClick={() => copyToClipboard("kitchen@restaurant.com", "Kitchen Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-orange-400">
                <span className="flex items-center gap-1.5">
                  <span>🍳 Kitchen</span>
                </span>
                <span className="text-[10px] bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 group-hover:bg-orange-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">kitchen@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>

            {/* Cashier */}
            <div
              onClick={() => copyToClipboard("cashier@restaurant.com", "Cashier Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span>💵 Cashier</span>
                </span>
                <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 group-hover:bg-emerald-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">cashier@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>

            {/* Cleaner */}
            <div
              onClick={() => copyToClipboard("cleaner@restaurant.com", "Cleaner Email")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900/80 cursor-pointer transition rounded-xl border border-slate-800 space-y-1 group"
            >
              <div className="flex justify-between items-center font-bold text-purple-400">
                <span className="flex items-center gap-1.5">
                  <span>🧹 Cleaner</span>
                </span>
                <span className="text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 group-hover:bg-purple-500/20">
                  Copy Email
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">cleaner@restaurant.com</p>
              <p className="text-slate-400 text-[10px]">
                Password: <code className="text-slate-200 font-mono font-semibold">Hackathon2026!</code>
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500">Customer Entrance?</span>
            <Link href="/join" className="text-sky-400 font-semibold hover:underline">
              Enter Customer Portal ➔
            </Link>
          </div>
        </div>

        {/* Clerk Sign-In Form Container */}
        <div
          className={`${
            activeTab === "signin" ? "block" : "hidden md:block"
          } bg-slate-900 border border-slate-800 rounded-3xl p-2 sm:p-4 shadow-2xl backdrop-blur-xl`}
        >
          <SignIn
            fallbackRedirectUrl="/redirect"
            forceRedirectUrl="/redirect"
            appearance={{
              elements: {
                card: "bg-slate-900 border-none shadow-none text-slate-100 p-3 sm:p-6",
                headerTitle: "text-lg sm:text-xl font-extrabold text-white",
                headerSubtitle: "text-xs font-medium text-slate-400",
                socialButtonsBlockButton:
                  "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl transition py-2",
                formButtonPrimary:
                  "bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20",
                formFieldLabel: "text-xs font-bold text-slate-300",
                formFieldInput:
                  "bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition px-3.5 py-2",
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
      </div>
    </main>
  );
}
