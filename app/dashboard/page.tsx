"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const role = profile?.role?.toLowerCase().trim() || "resident";
  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";
  const displayName = profile?.name?.trim() || user?.email?.split("@")[0] || "Resident";

  const hasOrg = !!profile?.organizationId;
  const orgName = profile?.organizationName;

  return (
    <Layout title="Dashboard">
      <section className="mb-10">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Welcome, {displayName}
        </h2>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-gray-400">
          Help improve your community by reporting local problems,
          confirming issues reported by others and following their
          progress.
        </p>
        {hasOrg && orgName && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2">
            <span className="text-xl">🏢</span>
            <span className="text-sm font-medium text-gray-300">
              Organisation: <span className="text-white">{orgName}</span>
            </span>
          </div>
        )}
      </section>

      {isStaff && (
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/staff")}
            className="group rounded-2xl border border-indigo-800 bg-indigo-950/20 p-6 text-left transition hover:border-indigo-500"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-950 text-2xl">
                🗂️
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">My Assigned Cases</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  View and manage reports assigned directly to you.
                </p>
                <p className="mt-4 font-semibold text-indigo-400 transition-colors group-hover:text-indigo-300">
                  Open cases →
                </p>
              </div>
            </div>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="group rounded-2xl border border-blue-800 bg-blue-950/20 p-6 text-left transition hover:border-blue-500"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-2xl">
                  🛡️
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">CivicPulse Operations</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    Review all reports, prioritise cases and manage assignments.
                  </p>
                  <p className="mt-4 font-semibold text-blue-400 transition-colors group-hover:text-blue-300">
                    Open operations →
                  </p>
                </div>
              </div>
            </button>
          )}
        </section>
      )}

      <section className="mb-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Community Tools
        </h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => router.push("/report/new")}
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-blue-600"
          >
            <div className="text-3xl">➕</div>
            <h3 className="mt-5 text-xl font-bold">Report an Issue</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Submit a new community issue with photo and location.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-purple-600"
          >
            <div className="text-3xl">📋</div>
            <h3 className="mt-5 text-xl font-bold">Browse Reports</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Explore issues reported by the community.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/my-reports")}
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-green-600"
          >
            <div className="text-3xl">🗂️</div>
            <h3 className="mt-5 text-xl font-bold">My Reports</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Track issues you personally submitted.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/map")}
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-orange-600"
          >
            <div className="text-3xl">🗺️</div>
            <h3 className="mt-5 text-xl font-bold">Community Map</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              View reported issues geographically.
            </p>
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Account &amp; Organisation
        </h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-gray-500"
          >
            <div className="text-3xl">👤</div>
            <h3 className="mt-5 text-xl font-bold">My Profile</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Manage your personal information and settings.
            </p>
          </button>

          {!hasOrg && (
            <>
              <button
                type="button"
                onClick={() => router.push("/invites")}
                className="group rounded-2xl border border-yellow-900 bg-yellow-950/20 p-6 text-left transition hover:border-yellow-600"
              >
                <div className="text-3xl">✉️</div>
                <h3 className="mt-5 text-xl font-bold">Pending Invitations</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Check and respond to organisation invites.
                </p>
              </button>

              <button
                type="button"
                onClick={() => router.push("/organization/setup")}
                className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-teal-500"
              >
                <div className="text-3xl">🏢</div>
                <h3 className="mt-5 text-xl font-bold">Create Organisation</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Set up a new organisation to manage civic reports.
                </p>
              </button>
            </>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/analytics")}
              className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-pink-500"
            >
              <div className="text-3xl">📈</div>
              <h3 className="mt-5 text-xl font-bold">Analytics</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                View organisation statistics and performance metrics.
              </p>
            </button>
          )}
        </div>
      </section>
    </Layout>
  );
}