"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  trustScore?: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [error, setError] =
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
        await getDoc(userRef);

      if (!snapshot.exists()) {
        setProfile({
          uid: user.uid,
          email: user.email ?? "",
          role: "resident",
          trustScore: 50,
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
        uid: user.uid,
        email: user.email ?? "",
        role: "resident",
      });

      setError(
        "Unable to load your complete profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    loadProfile();
  }, [
    user,
    authLoading,
  ]);

  async function handleLogout() {
    try {
      await signOut(auth);

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
            <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2">
              <p className="text-xs text-gray-500">
                Signed in as
              </p>

              <p className="max-w-52 truncate text-sm font-semibold text-gray-200">
                {displayName}
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
            {error}
          </div>
        )}

        <section className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Community Dashboard
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Welcome, {displayName}
          </h2>

          <p className="mt-3 max-w-2xl text-lg leading-8 text-gray-400">
            Help improve your community by reporting local problems,
            confirming issues reported by others and following their
            progress.
          </p>
        </section>

        {isStaff && (
          <section className="mt-8">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin"
                )
              }
              className="group w-full rounded-2xl border border-blue-800 bg-gradient-to-r from-blue-950/70 to-gray-900 p-6 text-left transition hover:border-blue-500"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-800 bg-blue-950 text-2xl">
                    🛡️
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold">
                        CivicPulse Operations
                      </h3>

                      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
                        Staff
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                      Review incoming reports, prioritise critical cases,
                      manage report statuses and monitor community issues.
                    </p>
                  </div>
                </div>

                <div className="text-2xl text-blue-400 transition group-hover:translate-x-1">
                  →
                </div>
              </div>
            </button>
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
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-blue-600 hover:bg-gray-900/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-2xl">
              ➕
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Report an Issue
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Submit a new community problem with a photo and GPS location.
            </p>

            <p className="mt-5 font-semibold text-blue-400">
              Create report{" "}
              <span className="inline-block transition group-hover:translate-x-1">
                →
              </span>
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/reports"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-purple-600 hover:bg-gray-900/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950 text-2xl">
              📋
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Browse Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              View issues submitted by residents and confirm problems you
              have also seen.
            </p>

            <p className="mt-5 font-semibold text-purple-400">
              Explore reports{" "}
              <span className="inline-block transition group-hover:translate-x-1">
                →
              </span>
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/my-reports"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-green-600 hover:bg-gray-900/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-950 text-2xl">
              🗂️
            </div>

            <h3 className="mt-5 text-xl font-bold">
              My Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Track the issues you have personally submitted and follow
              their progress.
            </p>

            <p className="mt-5 font-semibold text-green-400">
              View my reports{" "}
              <span className="inline-block transition group-hover:translate-x-1">
                →
              </span>
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/map"
              )
            }
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-orange-600 hover:bg-gray-900/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-950 text-2xl">
              🗺️
            </div>

            <h3 className="mt-5 text-xl font-bold">
              Community Map
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Explore reported issues geographically using the CivicPulse
              live map.
            </p>

            <p className="mt-5 font-semibold text-orange-400">
              Open map{" "}
              <span className="inline-block transition group-hover:translate-x-1">
                →
              </span>
            </p>
          </button>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="text-3xl">
              📍
            </div>

            <h3 className="mt-4 text-lg font-bold">
              Location Based
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Reports use GPS coordinates so communities can see exactly
              where an issue is happening.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="text-3xl">
              🤝
            </div>

            <h3 className="mt-4 text-lg font-bold">
              Community Confirmed
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Nearby residents can confirm existing reports, helping
              organisations identify issues affecting more people.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="text-3xl">
              📈
            </div>

            <h3 className="mt-4 text-lg font-bold">
              Trackable Progress
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Every report can move from submission through acknowledgement,
              action and eventual resolution.
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                CivicPulse Development
              </p>

              <h3 className="mt-2 text-xl font-bold">
                Community issue management platform
              </h3>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
                CivicPulse is being built to help residents and organisations
                report, verify, manage and resolve real community problems.
              </p>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Your role
              </p>

              <p className="mt-1 font-bold capitalize text-blue-300">
                {role}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}