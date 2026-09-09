"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
};

type Report = {
  id: string;

  title: string;
  description: string;

  category: string;
  severity: string;
  status: string;

  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedAt?: Timestamp | null;

  confirmationCount?: number;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const statuses = [
  "all",
  "assigned",
  "in-progress",
  "resolved",
  "reopened",
];

const severities = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];

function getStatusLabel(status: string) {
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
    default:
      return status;
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "assigned":
      return "border-indigo-800 bg-indigo-950/40 text-indigo-300";

    case "in-progress":
      return "border-yellow-800 bg-yellow-950/40 text-yellow-300";

    case "resolved":
      return "border-green-800 bg-green-950/40 text-green-300";

    case "reopened":
      return "border-orange-800 bg-orange-950/40 text-orange-300";

    default:
      return "border-gray-700 bg-gray-800 text-gray-300";
  }
}

function getSeverityClasses(severity: string) {
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

function getCategoryIcon(category: string) {
  switch (category) {
    case "Pothole":
      return "🕳️";

    case "Water Leak":
      return "💧";

    case "Power Outage":
      return "⚡";

    case "Broken Streetlight":
      return "💡";

    case "Illegal Dumping":
      return "⚠️";

    case "Road Hazard":
      return "🚧";

    case "Sewer Issue":
      return "☣️";

    case "Vandalism":
      return "🧱";

    default:
      return "📍";
  }
}

function formatDate(timestamp?: Timestamp | null) {
  if (!timestamp) {
    return "Unknown";
  }

  return timestamp.toDate().toLocaleString();
}

export default function StaffDashboardPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [reports, setReports] =
    useState<Report[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [severityFilter, setSeverityFilter] =
    useState("all");

  async function loadStaffDashboard() {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      const userSnapshot =
        await getDoc(userRef);

      if (!userSnapshot.exists()) {
        setProfile(null);

        setError(
          "Your CivicPulse profile could not be found."
        );

        return;
      }

      const profileData =
        userSnapshot.data() as UserProfile;

      setProfile(profileData);

      const role =
        profileData.role
          ?.toLowerCase()
          .trim();

      const authorised =
        role === "staff" ||
        role === "admin";

      if (!authorised) {
        setError(
          "You do not have permission to access staff cases."
        );

        return;
      }

      const reportsSnapshot =
        await getDocs(
          collection(
            db,
            "reports"
          )
        );

      const assignedReports =
        reportsSnapshot.docs
          .map((reportDoc) => ({
            id: reportDoc.id,
            ...reportDoc.data(),
          }))
          .filter((report) => {
            const item =
              report as Report;

            return (
              item.assignedTo ===
              user.uid
            );
          }) as Report[];

      assignedReports.sort(
        (a, b) => {
          const aTime =
            a.assignedAt?.seconds ??
            a.updatedAt?.seconds ??
            a.createdAt?.seconds ??
            0;

          const bTime =
            b.assignedAt?.seconds ??
            b.updatedAt?.seconds ??
            b.createdAt?.seconds ??
            0;

          return bTime - aTime;
        }
      );

      setReports(
        assignedReports
      );
    } catch (err) {
      console.error(
        "Staff dashboard error:",
        err
      );

      setError(
        "Failed to load your assigned cases."
      );
    } finally {
      setLoading(false);
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

    loadStaffDashboard();
  }, [
    user,
    authLoading,
  ]);

  const filteredReports =
    useMemo(() => {
      const searchTerm =
        search
          .trim()
          .toLowerCase();

      return reports.filter(
        (report) => {
          const matchesSearch =
            !searchTerm ||
            report.title
              ?.toLowerCase()
              .includes(
                searchTerm
              ) ||
            report.description
              ?.toLowerCase()
              .includes(
                searchTerm
              ) ||
            report.category
              ?.toLowerCase()
              .includes(
                searchTerm
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            report.status ===
              statusFilter;

          const matchesSeverity =
            severityFilter ===
              "all" ||
            report.severity ===
              severityFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSeverity
          );
        }
      );
    }, [
      reports,
      search,
      statusFilter,
      severityFilter,
    ]);

  const activeCount =
    reports.filter(
      (report) =>
        report.status ===
          "assigned" ||
        report.status ===
          "in-progress" ||
        report.status ===
          "reopened"
    ).length;

  const inProgressCount =
    reports.filter(
      (report) =>
        report.status ===
        "in-progress"
    ).length;

  const resolvedCount =
    reports.filter(
      (report) =>
        report.status ===
        "resolved"
    ).length;

  const criticalCount =
    reports.filter(
      (report) =>
        report.severity ===
          "critical" &&
        report.status !==
          "resolved"
    ).length;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSeverityFilter("all");
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-indigo-500" />

          <p className="mt-4 text-gray-400">
            Loading assigned cases...
          </p>
        </div>
      </main>
    );
  }

  const role =
    profile?.role
      ?.toLowerCase()
      .trim();

  const isAuthorised =
    role === "staff" ||
    role === "admin";

  if (!isAuthorised) {
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
            {error ||
              "This area is restricted to CivicPulse staff."}
          </p>

          <button
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Return to Dashboard
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
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold sm:text-4xl">
                My Assigned Cases
              </h1>

              <span className="rounded-full border border-indigo-800 bg-indigo-950/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
                {role}
              </span>
            </div>

            <p className="mt-2 text-gray-400">
              Manage the CivicPulse cases assigned directly to you.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {role === "admin" && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
              >
                🛡️ Operations
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={
                loadStaffDashboard
              }
              className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setStatusFilter(
                "all"
              );

              setSeverityFilter(
                "all"
              );
            }}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-indigo-600"
          >
            <p className="text-sm text-gray-400">
              Active Cases
            </p>

            <p className="mt-2 text-4xl font-bold">
              {activeCount}
            </p>

            <p className="mt-2 text-sm text-indigo-400">
              Currently assigned
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(
                "in-progress"
              );

              setSeverityFilter(
                "all"
              );
            }}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-yellow-600"
          >
            <p className="text-sm text-gray-400">
              In Progress
            </p>

            <p className="mt-2 text-4xl font-bold">
              {inProgressCount}
            </p>

            <p className="mt-2 text-sm text-yellow-400">
              Work underway
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(
                "resolved"
              );

              setSeverityFilter(
                "all"
              );
            }}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-green-600"
          >
            <p className="text-sm text-gray-400">
              Resolved
            </p>

            <p className="mt-2 text-4xl font-bold">
              {resolvedCount}
            </p>

            <p className="mt-2 text-sm text-green-400">
              Completed cases
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(
                "all"
              );

              setSeverityFilter(
                "critical"
              );
            }}
            className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-left transition hover:border-red-600"
          >
            <p className="text-sm text-red-300">
              Critical Open
            </p>

            <p className="mt-2 text-4xl font-bold text-red-300">
              {criticalCount}
            </p>

            <p className="mt-2 text-sm text-red-400">
              Needs attention
            </p>
          </button>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Search
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search my cases..."
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </label>

              <select
                value={
                  statusFilter
                }
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3"
              >
                {statuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status === "all"
                        ? "All Statuses"
                        : getStatusLabel(
                            status
                          )}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Severity
              </label>

              <select
                value={
                  severityFilter
                }
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3"
              >
                {severities.map(
                  (severity) => (
                    <option
                      key={severity}
                      value={severity}
                    >
                      {severity ===
                      "all"
                        ? "All Severities"
                        : severity
                            .charAt(0)
                            .toUpperCase() +
                          severity.slice(
                            1
                          )}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              Showing{" "}
              <span className="font-semibold text-white">
                {
                  filteredReports.length
                }
              </span>{" "}
              of{" "}
              <span className="font-semibold text-white">
                {reports.length}
              </span>{" "}
              assigned cases
            </p>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="text-sm font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section className="mt-6">
          {filteredReports.length ===
          0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center">
              <div className="text-5xl">
                🗂️
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                No assigned cases
              </h2>

              <p className="mt-2 text-gray-400">
                You currently have no cases matching these filters.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map(
                (report) => (
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
                    className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-indigo-600"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-800 text-3xl">
                        {getCategoryIcon(
                          report.category
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
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

                          <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300">
                            {
                              report.category
                            }
                          </span>
                        </div>

                        <h2 className="mt-3 truncate text-xl font-bold">
                          {
                            report.title
                          }
                        </h2>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">
                          {
                            report.description
                          }
                        </p>
                      </div>

                      <div className="grid shrink-0 grid-cols-2 gap-4 border-gray-800 lg:min-w-72 lg:border-l lg:pl-6">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-500">
                            Confirmations
                          </p>

                          <p className="mt-1 text-xl font-bold">
                            {report.confirmationCount ??
                              0}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-500">
                            Assigned
                          </p>

                          <p className="mt-1 text-sm text-gray-300">
                            {formatDate(
                              report.assignedAt
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-xl text-gray-500">
                        →
                      </div>
                    </div>
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