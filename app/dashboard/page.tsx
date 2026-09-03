"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { useAuth } from "@/src/lib/AuthContext";
import { auth } from "@/src/lib/firebase";

export default function DashboardPage() {
  const router = useRouter();

  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading CivicPulse...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              CivicPulse
            </h1>

            <p className="mt-1 text-gray-400">
              Community Reporting Dashboard
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-700 px-5 py-3 font-medium transition hover:bg-gray-800"
          >
            Logout
          </button>
        </header>

        {/* Welcome Card */}
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <p className="text-sm text-gray-400">
            Signed in as
          </p>

          <p className="mt-1 text-xl font-semibold">
            {user.email}
          </p>

          <div className="mt-8">
            <h2 className="text-3xl font-bold">
              Welcome to CivicPulse
            </h2>

            <p className="mt-3 max-w-2xl leading-7 text-gray-400">
              Report problems in your community, explore issues reported by
              other residents, and track the progress of the reports you have
              submitted.
            </p>
          </div>

          {/* Main Navigation Buttons */}
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => router.push("/report/new")}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500"
            >
              Report an Issue
            </button>

            <button
              onClick={() => router.push("/reports")}
              className="rounded-lg border border-gray-700 px-5 py-3 font-semibold transition hover:bg-gray-800"
            >
              Browse Reports
            </button>

            <button
              onClick={() => router.push("/my-reports")}
              className="rounded-lg border border-gray-700 px-5 py-3 font-semibold transition hover:bg-gray-800"
            >
              My Reports
            </button>
          </div>
        </section>

        {/* Quick Feature Cards */}
        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <button
            onClick={() => router.push("/report/new")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:-translate-y-1 hover:border-gray-700"
          >
            <div className="text-3xl">
              📍
            </div>

            <h3 className="mt-4 text-xl font-bold">
              Report a Problem
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Submit a civic issue with a description, severity, GPS location,
              and photo evidence.
            </p>
          </button>
<button
  onClick={() => router.push("/map")}
  className="rounded-lg border border-gray-700 px-5 py-3 font-semibold transition hover:bg-gray-800"
>
  View Map
</button>
          <button
            onClick={() => router.push("/reports")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:-translate-y-1 hover:border-gray-700"
          >
            <div className="text-3xl">
              🔎
            </div>

            <h3 className="mt-4 text-xl font-bold">
              Explore Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Browse problems reported by residents and confirm issues that you
              have also seen.
            </p>
          </button>

          <button
            onClick={() => router.push("/my-reports")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:-translate-y-1 hover:border-gray-700"
          >
            <div className="text-3xl">
              📋
            </div>

            <h3 className="mt-4 text-xl font-bold">
              Track My Reports
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              View the reports you submitted and track their status and
              community confirmations.
            </p>
          </button>
        </section>

        {/* Current Phase Notice */}
        <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-start gap-4">
            <div className="text-2xl">
              🚧
            </div>

            <div>
              <h3 className="font-semibold">
                CivicPulse Phase 1
              </h3>

              <p className="mt-1 text-sm leading-6 text-gray-400">
                The platform currently supports authentication, report
                creation, photo evidence, GPS coordinates, community
                confirmations, report browsing, and personal report tracking.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}