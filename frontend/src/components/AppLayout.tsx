"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const { hasRole, hasPermission, roles, isSuperadmin } = useRBAC();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (
    pathname === "/" ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/sign-in") ||
    pathname === "/reviews/submit"
  ) {
    return <>{children}</>;
  }

  if (!isLoaded || !isSignedIn) {
    return <>{children}</>;
  }

  const primaryRole = isSuperadmin
    ? "Superadmin"
    : roles.length > 0
    ? roles[0].name
    : "Staff";

  const navigation = [
    {
      group: "OPERATIONS",
      items: [
        {
          href: "/manager/dashboard",
          label: "Executive Hub",
          icon: "👔",
          show: hasRole("manager", "admin") || isSuperadmin,
        },
        {
          href: "/cashier",
          label: "Cashier POS",
          icon: "💵",
          show: hasRole("cashier", "waiter", "manager", "admin") || isSuperadmin,
        },
        {
          href: "/waiter/dashboard",
          label: "Waiter POS",
          icon: "📋",
          show: hasPermission("order:view") || hasRole("waiter", "manager", "admin"),
        },
        {
          href: "/kitchen/dashboard",
          label: "Kitchen KDS",
          icon: "🍳",
          show: hasPermission("order:kitchen_update") || hasRole("kitchen", "manager", "admin"),
        },
        {
          href: "/cleaning/dashboard",
          label: "Cleaning",
          icon: "🧹",
          show: hasPermission("table:edit") || hasRole("cleaning_staff", "manager", "admin"),
        },
      ],
    },
    {
      group: "MANAGEMENT",
      items: [
        {
          href: "/tables",
          label: "Floor & Tables",
          icon: "🪑",
          show: hasPermission("table:view"),
        },
        {
          href: "/menu/items",
          label: "Menu Items",
          icon: "🍔",
          show: hasPermission("menu:view"),
        },
        {
          href: "/recipes",
          label: "Recipes & Costing",
          icon: "📖",
          show: hasPermission("inventory:view") || hasPermission("menu:view"),
        },
        {
          href: "/inventory/dashboard",
          label: "Inventory Control",
          icon: "📦",
          show: hasPermission("inventory:view"),
        },
        {
          href: "/staff",
          label: "Staff Directory",
          icon: "👥",
          show: hasPermission("staff:view"),
        },
        {
          href: "/reviews/manage",
          label: "Customer Reviews",
          icon: "⭐",
          show: hasPermission("review:view"),
        },
        {
          href: "/settings",
          label: "System Settings",
          icon: "⚙️",
          show: hasPermission("restaurant:edit") || hasRole("manager", "admin"),
        },
      ],
    },
  ];

  const getBreadcrumb = () => {
    if (pathname.startsWith("/manager")) return "Executive Overview";
    if (pathname.startsWith("/cashier")) return "Cashier Terminal";
    if (pathname.startsWith("/waiter")) return "Waiter POS Terminal";
    if (pathname.startsWith("/kitchen")) return "Kitchen Display System";
    if (pathname.startsWith("/cleaning")) return "Cleaning Management";
    if (pathname.startsWith("/tables")) return "Floor Layout & Tables";
    if (pathname.startsWith("/menu")) return "Menu Management";
    if (pathname.startsWith("/recipes") || pathname.startsWith("/recipe")) return "Recipes & Food Costing";
    if (pathname.startsWith("/inventory")) return "Inventory & Stock";
    if (pathname.startsWith("/staff")) return "Staff Directory";
    if (pathname.startsWith("/reviews")) return "Customer Reviews";
    if (pathname.startsWith("/settings")) return "System Settings";
    return "Dashboard";
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex overflow-x-hidden">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-[#020617]/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar: Background #020617, Active #2563EB, Hover #1E293B, Icons #CBD5E1 */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-[#334155] bg-[#020617] transition-all duration-200 ${
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-16" : "md:w-60"}`}
      >
        <div>
          <div className="flex items-center justify-between border-b border-[#334155] p-4">
            <Link href="/manager/dashboard" className="flex items-center space-x-2.5 overflow-hidden">
              <span className="text-xl shrink-0">🍽️</span>
              {(!collapsed || mobileOpen) && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-tight text-[#F8FAFC] uppercase">
                    ResMan OS
                  </span>
                  <span className="text-[10px] text-[#22C55E] font-semibold flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
                    <span>Live Operational</span>
                  </span>
                </div>
              )}
            </Link>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block text-[#CBD5E1] hover:text-white text-xs p-1 rounded-md hover:bg-[#1E293B] transition"
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? "⏩" : "⏪"}
            </button>

            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-[#CBD5E1] hover:text-white text-xs p-1 font-bold"
            >
              ✕
            </button>
          </div>

          <div className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navigation.map((section, idx) => {
              const visibleItems = section.items.filter((item) => item.show);
              if (visibleItems.length === 0) return null;
              return (
                <div key={idx} className="space-y-1">
                  {(!collapsed || mobileOpen) && (
                    <p className="px-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      {section.group}
                    </p>
                  )}
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center space-x-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          isActive
                            ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-[#2563EB]/20"
                            : "text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white"
                        }`}
                      >
                        <span className="text-sm shrink-0 text-[#CBD5E1]">{item.icon}</span>
                        {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#334155] p-3 bg-[#020617]">
          <div className="flex items-center space-x-2.5">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 rounded-full border border-[#334155]",
                },
              }}
            />
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#F8FAFC] truncate">Staff Session</span>
                <span className="text-[10px] font-semibold text-[#2563EB] truncate">
                  Role: {primaryRole}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ml-0 ${
          collapsed ? "md:ml-16" : "md:ml-60"
        }`}
      >
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#334155] bg-[#0F172A]/95 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-[#CBD5E1] hover:text-white p-1.5 rounded-lg bg-[#1E293B] border border-[#334155] text-sm font-bold"
              aria-label="Open Navigation Drawer"
            >
              ☰
            </button>

            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="hidden sm:inline text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                System /
              </span>
              <span className="text-xs font-bold text-[#F8FAFC] tracking-wide truncate max-w-[140px] sm:max-w-none">
                {getBreadcrumb()}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-[#020617] px-3 py-1 rounded-md border border-[#334155] text-[11px] font-mono text-[#CBD5E1]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-ping"></span>
              <span>{currentTime}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <span className="hidden lg:inline text-[11px] font-semibold text-[#2563EB] bg-[#2563EB]/10 border border-[#2563EB]/20 px-2.5 py-1 rounded-md">
              {primaryRole} Mode
            </span>
            <Link
              href="/cashier"
              className="px-3 py-1 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition"
            >
              💵 Register
            </Link>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 lg:p-8 bg-[#0F172A] text-[#F8FAFC]">{children}</main>
      </div>
    </div>
  );
}
