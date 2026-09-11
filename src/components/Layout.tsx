"use client";

import { useAuth } from "@/src/lib/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { RoleBadge } from "./RoleBadge";
import { LoadingState } from "./LoadingState";

interface LayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireRole?: string[];
  title?: string;
}

export function Layout({
  children,
  requireAuth = true,
  requireRole,
  title,
}: LayoutProps) {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Realtime unread notification count
  useEffect(() => {
    if (!user) return;

    const unreadQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(
      unreadQuery,
      (snapshot) => setUnreadCount(snapshot.size),
      (err) => {
        console.error("Notification listener error:", err);
        setUnreadCount(0);
      }
    );

    return unsubscribe;
  }, [user]);

  // Auth protection
  useEffect(() => {
    if (loading) return;
    if (requireAuth && !user) {
      router.replace("/login");
    }
  }, [user, loading, requireAuth, router]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return <LoadingState message="Loading CivicPulse..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  // Role check
  const role = profile?.role?.toLowerCase().trim() || "resident";
  if (requireRole && !requireRole.includes(role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="text-5xl">🚫</div>
          <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-gray-400">
            You don&apos;t have permission to view this page.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold hover:bg-blue-500"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";
  const displayName =
    profile?.name?.trim() || user?.email?.split("@")[0] || "User";
  const orgName = profile?.organizationName;
  const orgRole = profile?.organizationRole;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/reports", label: "Reports", icon: "📋" },
    { href: "/map", label: "Map", icon: "🗺️" },
    { href: "/my-reports", label: "My Reports", icon: "🗂️" },
  ];

  if (isStaff) {
    navLinks.push({ href: "/staff", label: "My Cases", icon: "📁" });
  }

  if (isAdmin) {
    navLinks.push({ href: "/admin", label: "Operations", icon: "🛡️" });
  }

  if (isAdmin || orgRole === "owner" || orgRole === "admin" || orgRole === "manager") {
    navLinks.push({
      href: "/organization/manage",
      label: "Organisation",
      icon: "🏢",
    });
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top navigation bar */}
      <nav className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Logo + Org */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xl font-bold tracking-tight"
              >
                CivicPulse
              </button>
              {orgName && (
                <span className="hidden rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-400 sm:inline-block">
                  {orgName}
                </span>
              )}
            </div>

            {/* Center: Desktop nav links */}
            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive(link.href)
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-900 hover:text-white"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Role badge */}
              {isStaff && (
                <div className="hidden sm:block">
                  <RoleBadge role={role} />
                </div>
              )}

              {/* Notification bell */}
              <button
                type="button"
                onClick={() => router.push("/notifications")}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-lg transition hover:border-blue-600 hover:bg-gray-800"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* User info + Logout (desktop) */}
              <div className="hidden items-center gap-2 sm:flex">
                <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5">
                  <p className="max-w-32 truncate text-sm font-medium text-gray-200">
                    {displayName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push("/login");
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium hover:bg-gray-800"
                >
                  Log Out
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-lg md:hidden"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-800 px-4 pb-4 pt-2 md:hidden">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive(link.href)
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-900 hover:text-white"
                  }`}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </button>
              ))}
              <hr className="border-gray-800" />
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white"
              >
                <span>👤</span>
                Profile ({displayName})
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-gray-900"
              >
                <span>🚪</span>
                Log Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Page title header */}
      {title && (
        <header className="border-b border-gray-800 bg-gray-950">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          </div>
        </header>
      )}

      {/* Page content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

export default Layout;
