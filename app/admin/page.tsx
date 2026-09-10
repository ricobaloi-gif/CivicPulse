"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
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

  organizationId?: string | null;
  organizationName?: string | null;
  organizationRole?: string | null;
};

type Report = {
  id: string;

  title: string;
  description?: string;

  category: string;
  severity: string;
  status: string;

  confirmationCount?: number;

  assignedTo?: string | null;
  assignedToName?: string | null;

  organizationId?: string | null;
  organizationName?: string | null;
};

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "submitted":
      return "Submitted";

    case "acknowledged":
      return "Acknowledged";

    case "assigned":
      return "Assigned";

    case "in-progress":
      return "In Progress";

    case "resolved":
      return "Resolved";

    case "reopened":
      return "Reopened";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "duplicate":
      return "Duplicate";

    default:
      return status;
  }
}

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "submitted":
      return "border-blue-800 bg-blue-950/40 text-blue-300";

    case "acknowledged":
      return "border-purple-800 bg-purple-950/40 text-purple-300";

    case "assigned":
      return "border-indigo-800 bg-indigo-950/40 text-indigo-300";

    case "in-progress":
      return "border-yellow-800 bg-yellow-950/40 text-yellow-300";

    case "resolved":
      return "border-green-800 bg-green-950/40 text-green-300";

    case "reopened":
      return "border-orange-800 bg-orange-950/40 text-orange-300";

    case "rejected":
      return "border-red-800 bg-red-950/40 text-red-300";

    default:
      return "border-gray-700 bg-gray-800 text-gray-300";
  }
}

function getSeverityClasses(
  severity: string
) {
  switch (severity) {
    case "critical":
      return "border-red-800 bg-red-950/40 text-red-300";

    case "high":
      return "border-orange-800 bg-orange-950/40 text-orange-300";

    case "medium":
      return "border-yellow-800 bg-yellow-950/40 text-yellow-300";

    case "low":
      return "border-green-800 bg-green-950/40 text-green-300";

    default:
      return "border-gray-700 bg-gray-800 text-gray-300";
  }
}

export default function AdminPage() {
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
    reports,
    setReports,
  ] =
    useState<Report[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState("all");

  const [
    error,
    setError,
  ] =
    useState("");

  async function loadData(
    showRefreshing = false
  ) {
    if (!user) {
      return;
    }

    try {
      if (
        showRefreshing
      ) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );

      const userSnapshot =
        await getDoc(
          userRef
        );

      if (
        !userSnapshot.exists()
      ) {
        setError(
          "Your CivicPulse profile could not be found."
        );

        return;
      }

      const currentProfile =
        userSnapshot.data() as UserProfile;

      setProfile(
        currentProfile
      );

      const role =
        currentProfile.role
          ?.toLowerCase()
          .trim();

      if (
        role !== "admin"
      ) {
        return;
      }

      if (
        !currentProfile.organizationId
      ) {
        setReports([]);

        return;
      }

      const reportsQuery =
        query(
          collection(
            db,
            "reports"
          ),
          where(
            "organizationId",
            "==",
            currentProfile.organizationId
          )
        );

      const snapshot =
        await getDocs(
          reportsQuery
        );

      const items =
        snapshot.docs.map(
          (
            reportDoc
          ) => ({
            id:
              reportDoc.id,

            ...reportDoc.data(),
          })
        ) as Report[];

      setReports(
        items
      );
    } catch (err) {
      console.error(
        "Admin dashboard error:",
        err
      );

      setError(
        "Unable to load organisation reports."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
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

    loadData();
  }, [
    user,
    authLoading,
  ]);

  const role =
    profile?.role
      ?.toLowerCase()
      .trim();

  const isAdmin =
    role === "admin";

  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            reports
              .map(
                (
                  report
                ) =>
                  report.category
              )
              .filter(
                Boolean
              )
          )
        ).sort(),

      [
        reports,
      ]
    );

  const filteredReports =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return reports.filter(
          (
            report
          ) => {
            if (
              statusFilter !==
                "all" &&
              report.status !==
                statusFilter
            ) {
              return false;
            }

            if (
              severityFilter !==
                "all" &&
              report.severity !==
                severityFilter
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "all" &&
              report.category !==
                categoryFilter
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const haystack =
              [
                report.title,
                report.description,
                report.category,
                report.status,
                report.severity,
                report.assignedToName,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
                .toLowerCase();

            return haystack.includes(
              normalizedSearch
            );
          }
        );
      },

      [
        reports,
        search,
        statusFilter,
        severityFilter,
        categoryFilter,
      ]
    );

  const awaitingReview =
    reports.filter(
      (
        report
      ) =>
        report.status ===
          "submitted"
    ).length;

  const activeCases =
    reports.filter(
      (
        report
      ) =>
        ![
          "resolved",
          "rejected",
          "duplicate",
        ].includes(
          report.status
        )
    ).length;

  const resolved =
    reports.filter(
      (
        report
      ) =>
        report.status ===
          "resolved"
    ).length;

  const criticalOpen =
    reports.filter(
      (
        report
      ) =>
        report.severity ===
          "critical" &&
        report.status !==
          "resolved"
    ).length;

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />

          <p className="mt-4 text-gray-400">
            Loading operations...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🔒
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Access Denied
          </h1>

          <p className="mt-3 text-gray-400">
            Only CivicPulse administrators can access the Operations Dashboard.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (
    !profile?.organizationId
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🏢
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Organisation Required
          </h1>

          <p className="mt-3 text-gray-400">
            Create or join an organisation before using CivicPulse Operations.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/organization/setup"
              )
            }
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Organisation Setup
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-gray-800 pb-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              CivicPulse Operations
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {
                profile.organizationName ||
                "Organisation"
              }
            </h1>

            <p className="mt-2 text-gray-400">
              Organisation-scoped case management and operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/organization/manage"
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
            >
              👥 Manage Organisation
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/map"
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
            >
              🗺️ Map
            </button>

            <button
              type="button"
              onClick={() =>
                loadData(
                  true
                )
              }
              disabled={
                refreshing
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500"
            >
              Dashboard
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {
              error
            }
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-900 bg-blue-950/20 p-6">
            <p className="text-sm text-blue-300">
              Awaiting Review
            </p>

            <p className="mt-3 text-4xl font-bold">
              {
                awaitingReview
              }
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-900 bg-indigo-950/20 p-6">
            <p className="text-sm text-indigo-300">
              Active Cases
            </p>

            <p className="mt-3 text-4xl font-bold">
              {
                activeCases
              }
            </p>
          </div>

          <div className="rounded-2xl border border-green-900 bg-green-950/20 p-6">
            <p className="text-sm text-green-300">
              Resolved
            </p>

            <p className="mt-3 text-4xl font-bold">
              {
                resolved
              }
            </p>
          </div>

          <div className="rounded-2xl border border-red-900 bg-red-950/20 p-6">
            <p className="text-sm text-red-300">
              Critical Open
            </p>

            <p className="mt-3 text-4xl font-bold">
              {
                criticalOpen
              }
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <input
              type="text"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search reports..."
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="submitted">
                Submitted
              </option>

              <option value="acknowledged">
                Acknowledged
              </option>

              <option value="assigned">
                Assigned
              </option>

              <option value="in-progress">
                In Progress
              </option>

              <option value="resolved">
                Resolved
              </option>

              <option value="reopened">
                Reopened
              </option>
            </select>

            <select
              value={
                severityFilter
              }
              onChange={(
                event
              ) =>
                setSeverityFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
            >
              <option value="all">
                All Severities
              </option>

              <option value="critical">
                Critical
              </option>

              <option value="high">
                High
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="low">
                Low
              </option>
            </select>

            <select
              value={
                categoryFilter
              }
              onChange={(
                event
              ) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
            >
              <option value="all">
                All Categories
              </option>

              {categories.map(
                (
                  category
                ) => (
                  <option
                    key={
                      category
                    }
                    value={
                      category
                    }
                  >
                    {
                      category
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Organisation Reports
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Showing{" "}
                {
                  filteredReports.length
                }{" "}
                of{" "}
                {
                  reports.length
                }{" "}
                reports
              </p>
            </div>
          </div>

          {reports.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
              <div className="text-5xl">
                📋
              </div>

              <h3 className="mt-4 text-xl font-bold">
                No organisation reports yet
              </h3>

              <p className="mt-2 text-gray-500">
                New reports created by members of this organisation will appear here.
              </p>
            </div>
          ) : filteredReports.length ===
            0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-10 text-center text-gray-400">
              No reports match the current filters.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredReports.map(
                (
                  report
                ) => (
                  <button
                    key={
                      report.id
                    }
                    type="button"
                    onClick={() =>
                      router.push(
                        `/report/${report.id}`
                      )
                    }
                    className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-blue-600"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                          report.status
                        )}`}
                      >
                        {getStatusLabel(
                          report.status
                        )}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getSeverityClasses(
                          report.severity
                        )}`}
                      >
                        {
                          report.severity
                        }
                      </span>

                      <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1 text-xs text-gray-400">
                        {
                          report.category
                        }
                      </span>
                    </div>

                    <h3 className="mt-4 text-xl font-bold">
                      {
                        report.title
                      }
                    </h3>

                    {report.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">
                        {
                          report.description
                        }
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                      <p>
                        Confirmations:{" "}
                        {
                          report.confirmationCount ??
                          0
                        }
                      </p>

                      <p>
                        Assigned:{" "}
                        {
                          report.assignedToName ||
                          "Unassigned"
                        }
                      </p>
                    </div>

                    <p className="mt-5 font-semibold text-blue-400">
                      Open case →
                    </p>
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}