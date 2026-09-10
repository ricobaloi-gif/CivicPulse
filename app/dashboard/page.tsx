"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/src/lib/firebase";

import {
  useAuth,
} from "@/src/lib/AuthContext";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  trustScore?: number;
};

export default function DashboardPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    profile,
    setProfile,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(true);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    notificationLoading,
    setNotificationLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  async function loadProfile() {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);

      return;
    }

    try {
      setProfileLoading(true);
      setError("");

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );

      const snapshot =
        await getDoc(
          userRef
        );

      if (
        !snapshot.exists()
      ) {
        setProfile({
          uid:
            user.uid,

          email:
            user.email ?? "",

          role:
            "resident",

          trustScore:
            50,
        });

        return;
      }

      setProfile(
        snapshot.data() as UserProfile
      );
    } catch (err) {
      console.error(
        "Dashboard profile error:",
        err
      );

      setProfile({
        uid:
          user.uid,

        email:
          user.email ?? "",

        role:
          "resident",
      });

      setError(
        "Unable to load your complete profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadUnreadNotifications() {
    if (!user) {
      setUnreadCount(0);
      setNotificationLoading(false);

      return;
    }

    try {
      setNotificationLoading(true);

      const unreadQuery =
        query(
          collection(
            db,
            "notifications"
          ),
          where(
            "userId",
            "==",
            user.uid
          ),
          where(
            "read",
            "==",
            false
          )
        );

      const snapshot =
        await getDocs(
          unreadQuery
        );

      setUnreadCount(
        snapshot.size
      );
    } catch (err) {
      console.error(
        "Notification count error:",
        err
      );

      setUnreadCount(0);
    } finally {
      setNotificationLoading(false);
    }
  }

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    loadProfile();
    loadUnreadNotifications();
  }, [
    user,
    authLoading,
  ]);

  async function handleLogout() {
    try {
      await signOut(
        auth
      );

      router.push(
        "/login"
      );
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );

      setError(
        "Failed to log out."
      );
    }
  }

  if (
    authLoading ||
    profileLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />

          <p className="mt-4 text-gray-400">
            Loading CivicPulse...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const role =
    profile?.role
      ?.toLowerCase()
      .trim() ||
    "resident";

  const isStaff =
    role === "staff" ||
    role === "admin";

  const isAdmin =
    role === "admin";

  const displayName =
    profile?.name?.trim() ||
    user.email?.split("@")[0] ||
    "Resident";

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-gray-800 pb-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold sm:text-4xl">
                CivicPulse
              </h1>

              {isStaff && (
                <span className="rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
                  {role}
                </span>
              )}
            </div>

            <p className="mt-2 text-gray-400">
              Report. Confirm. Track. Resolve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/notifications"
                )
              }
              className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-xl transition hover:border-blue-600 hover:bg-gray-800"
              aria-label="Notifications"
            >
              🔔

              {!notificationLoading &&
                unreadCount >
                  0 && (
                  <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {unreadCount >
                    99
                      ? "99+"
                      : unreadCount}
                  </span>
                )}
            </button>

            <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2">
              <p className="text-xs text-gray-500">
                Signed in as
              </p>

              <p className="max-w-52 truncate text-sm font-semibold text-gray-200">
                {
                  displayName
                }
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
            >
              Log Out
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-yellow-900 bg-yellow-950/30 p-4 text-yellow-300">
            {
              error
            }
          </div>
        )}

        <section className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Community Dashboard
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Welcome,{" "}
            {
              displayName
            }
          </h2>

          <p className="mt-3 max-w-2xl text-lg leading-8 text-gray-400">
            Help improve your community by reporting local problems,
            confirming issues reported by others and following their
            progress.
          </p>
        </section>

        {isStaff && (
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/staff"
                )
              }
              className="group rounded-2xl border border-indigo-800 bg-indigo-950/20 p-6 text-left transition hover:border-indigo-500"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-950 text-2xl">
                  🗂️
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    My Assigned Cases
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    View and manage reports assigned directly to you.
                  </p>

                  <p className="mt-4 font-semibold text-indigo-400">
                    Open cases →
                  </p>
                </div>
              </div>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="group rounded-2xl border border-blue-800 bg-blue-950/20 p-6 text-left transition hover:border-blue-500"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-2xl">
                    🛡️
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-bold">
                      CivicPulse Operations
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      Review all reports, prioritise cases and manage assignments.
                    </p>

                    <p className="mt-4 font-semibold text-blue-400">
                      Open operations →
                    </p>
                  </div>
                </div>
              </button>
            )}
          </section>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/report/new"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-blue-600"
          >
            <div className="text-3xl">
              ➕
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Report an Issue
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Submit a new community issue with photo and location.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/reports"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-purple-600"
          >
            <div className="text-3xl">
              📋
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Browse Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Explore issues reported by the community.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/my-reports"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-green-600"
          >
            <div className="text-3xl">
              🗂️
            </div>

            <h3 className="mt-5 text-xl font-bold">
              My Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Track issues you personally submitted.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/map"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-orange-600"
          >
            <div className="text-3xl">
              🗺️
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Community Map
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              View reported issues geographically.
            </p>
          </button>
        </section>
      </div>
    </main>
  );
}