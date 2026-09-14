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
import {
  Home,
  FileText,
  Map,
  FolderOpen,
  Briefcase,
  Shield,
  Building2,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
} from "lucide-react";

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

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !user) {
      router.replace("/login");
    }
  }, [user, loading, requireAuth, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return <LoadingState message="Loading CivicPulse..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  const role = profile?.role?.toLowerCase().trim() || "resident";
  if (requireRole && !requireRole.includes(role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-muted text-3xl">
            <Shield className="h-8 w-8 text-danger" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 btn-primary"
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
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/map", label: "Map", icon: Map },
    { href: "/my-reports", label: "My Reports", icon: FolderOpen },
  ];

  if (isStaff) {
    navLinks.push({ href: "/staff", label: "My Cases", icon: Briefcase });
  }

  if (isAdmin) {
    navLinks.push({ href: "/admin", label: "Operations", icon: Shield });
  }

  if (isAdmin || orgRole === "owner" || orgRole === "admin" || orgRole === "manager") {
    navLinks.push({
      href: "/organization/manage",
      label: "Organisation",
      icon: Building2,
    });
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xl font-bold tracking-tight"
              >
                CivicPulse
              </button>
              {orgName && (
                <span className="hidden rounded-lg border border-border bg-surface-elevated px-2.5 py-1 text-xs text-muted-foreground sm:inline-block">
                  {orgName}
                </span>
              )}
            </div>

            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => router.push(link.href)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive(link.href)
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="ml-1">{link.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {isStaff && (
                <div className="hidden sm:block">
                  <RoleBadge role={role} />
                </div>
              )}

              <button
                type="button"
                onClick={() => router.push("/notifications")}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-elevated transition hover:border-primary hover:bg-surface-hover"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <div className="hidden items-center gap-2 sm:flex">
                <div className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5">
                  <p className="max-w-32 truncate text-sm font-medium text-foreground">
                    {displayName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push("/login");
                  }}
                  className="btn-secondary"
                >
                  Log Out
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-elevated md:hidden"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border px-4 pb-4 pt-2 md:hidden">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => router.push(link.href)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                      isActive(link.href)
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
</button>
                );
              })}
              <hr className="border-border" />
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <User className="h-5 w-5" />
                Profile ({displayName})
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-surface-hover"
              >
                <LogOut className="h-5 w-5" />
                Log Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {title && (
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          </div>
        </header>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

export default Layout;