"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { isSignedIn, isLoaded } = useUser();
  const { hasRole, hasPermission, roles, isSuperadmin, designatedDashboard } = useRBAC();
  const pathname = usePathname();

  // Hide nav bar entirely on guest entrance / join pages for customer experience
  if (pathname.startsWith("/join") || pathname === "/reviews/submit") {
    return null;
  }

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const navLinks = [
    {
      href: designatedDashboard || "/",
      label: "Workspace",
      icon: "🏠",
      show: true,
    },
    {
      href: "/manager/dashboard",
      label: "Manager Hub",
      icon: "👔",
      show: hasRole("manager", "admin") || isSuperadmin,
    },
    {
      href: "/waiter/dashboard",
      label: "Waiter POS",
      icon: "📋",
      show: hasPermission("order:view") || hasRole("waiter", "manager", "admin"),
    },
    {
      href: "/cashier",
      label: "Cashier POS",
      icon: "💵",
      show: hasRole("cashier", "waiter", "manager", "admin") || isSuperadmin,
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
    {
      href: "/tables",
      label: "Tables",
      icon: "🪑",
      show: hasPermission("table:view"),
    },
    {
      href: "/menu/items",
      label: "Menu",
      icon: "🍔",
      show: hasPermission("menu:view"),
    },
    {
      href: "/recipes",
      label: "Recipes",
      icon: "📖",
      show: hasPermission("inventory:view") || hasPermission("menu:view"),
    },
    {
      href: "/inventory/dashboard",
      label: "Inventory",
      icon: "📦",
      show: hasPermission("inventory:view"),
    },
    {
      href: "/staff",
      label: "Staff",
      icon: "👥",
      show: hasPermission("staff:view"),
    },
    {
      href: "/reviews/manage",
      label: "Reviews",
      icon: "⭐",
      show: hasPermission("review:view"),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: "⚙️",
      show: hasPermission("restaurant:edit") || hasRole("manager", "admin"),
    },
  ];

  const visibleLinks = navLinks.filter((link) => link.show);
  const primaryRole = isSuperadmin
    ? "Superadmin"
    : roles.length > 0
    ? roles[0].name
    : "Staff";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand logo & active role badge */}
        <div className="flex items-center space-x-3">
          <Link href={designatedDashboard || "/"} className="flex items-center space-x-2 text-white hover:opacity-90">
            <span className="text-xl">🍽️</span>
            <span className="text-sm font-bold tracking-tight text-slate-100 hidden sm:inline">
              ResMan OS
            </span>
          </Link>
          <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-400 border border-sky-500/20">
            {primaryRole}
          </span>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1 overflow-x-auto max-w-3xl py-1">
          {visibleLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-slate-800 text-white font-semibold border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 rounded-full border border-slate-700",
              },
            }}
          />
        </div>
      </div>

      {/* Mobile Scrollable Navigation Bar */}
      <nav className="md:hidden flex items-center space-x-1 border-t border-slate-800/80 px-4 py-2 overflow-x-auto scrollbar-none bg-slate-900">
        {visibleLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center space-x-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                isActive
                  ? "bg-slate-800 text-white font-semibold border border-slate-700"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
