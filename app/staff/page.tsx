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

    default:
      return status;
  }
}

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "assigned":
      return "border-indigo-800 bg-indigo-950/40 text-indigo-300";

    case "acknowledged":
      return "border-purple-800 bg-purple-950/40 text-purple-300";

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

export default function StaffPage() {
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
    error,
    setError,
  ] =
    useState("");

  async function loadData() {
    if (!user) {
      return;
    }

    const currentUser =
      user;

    try {
      setLoading(true);
      setError("");

      const userRef =
        doc(
          db,
          "users",
          currentUser.uid
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

      const allowed =
        role === "staff" ||
        role === "admin";

      if (!allowed) {
        setReports([]);

        return;
      }

      if (
        !currentProfile.organizationId
      ) {
        setReports([]);

        return;
      }

      const organizationReportsQuery =
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
          organizationReportsQuery
        );

      /*
       * Important:
       * Cast every Firestore document to Report BEFORE
       * filtering it.
       *
       * This prevents TypeScript from thinking each report
       * contains only { id: string }.
       */
      const organizationReports: Report[] =
        snapshot.docs.map(
          (
            reportDoc
          ) => ({
            id:
              reportDoc.id,

            ...(reportDoc.data() as Omit<
              Report,
              "id"
            >),
          })
        );

      const assignedReports =
        organizationReports.filter(
          (
            report
          ) =>
            report.assignedTo ===
            currentUser.uid
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
        "Unable to load your assigned cases."
      );
    } finally {
      setLoading(false);
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

  const isStaff =
    role === "staff" ||
    role === "admin";

  const isAdmin =
    role === "admin";

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
      ]
    );

  const activeCases =
    reports.filter(
      (
        report
      ) =>
        report.status !==
          "resolved"
    ).length;

  const inProgress =
    reports.filter(
      (
        report
      ) =>
        report.status ===
          "in-progress"
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
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-indigo-500" />

          <p className="mt-4 text-gray-400">
            Loading assigned cases...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!isStaff) {
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
            This page is available only to CivicPulse staff.
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
        <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🏢
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            No Organisation
          </h1>

          <p className="mt-3 text-gray-400">
            Your staff account needs to belong to an organisation before cases can be assigned to you.
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

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-gray-800 pb-7 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Assigned Cases
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              My Cases
            </h1>

            <p className="mt-2 text-gray-400">
              {
                profile.organizationName
              }
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={
                loadData
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-semibold hover:bg-gray-800"
            >
              ↻ Refresh
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="rounded-lg border border-blue-800 bg-blue-950/30 px-4 py-3 font-semibold text-blue-300 hover:bg-blue-950"
              >
                Operations
              </button>
            )}

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

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="rounded-2xl border border-yellow-900 bg-yellow-950/20 p-6">
            <p className="text-sm text-yellow-300">
              In Progress
            </p>

            <p className="mt-3 text-4xl font-bold">
              {
                inProgress
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
          <div className="grid gap-4 md:grid-cols-3">
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
              placeholder="Search assigned cases..."
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-indigo-500"
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
          </div>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-2xl font-bold">
              Assigned to Me
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {
                filteredReports.length
              }{" "}
              case
              {filteredReports.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>

          {reports.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
              <div className="text-5xl">
                🗂️
              </div>

              <h3 className="mt-4 text-xl font-bold">
                No cases assigned
              </h3>

              <p className="mt-2 text-gray-500">
                Cases assigned to you by your organisation will appear here.
              </p>
            </div>
          ) : filteredReports.length ===
            0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-10 text-center text-gray-400">
              No assigned cases match your filters.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
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
                    className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-indigo-600"
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
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
                          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-gray-400">
                            {
                              report.description
                            }
                          </p>
                        )}

                        <p className="mt-4 text-sm text-gray-500">
                          Confirmations:{" "}
                          {
                            report.confirmationCount ??
                            0
                          }
                        </p>
                      </div>

                      <span className="shrink-0 font-semibold text-indigo-400">
                        Open case →
                      </span>
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