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
};

type Report = {
  id: string;

  title: string;
  description?: string;

  category: string;
  severity: string;
  status: string;

  confirmationCount?: number;

  imageUrl?: string | null;

  createdBy: string;

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

export default function MyReportsPage() {
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

      const profileRef =
        doc(
          db,
          "users",
          currentUser.uid
        );

      const profileSnapshot =
        await getDoc(
          profileRef
        );

      if (
        !profileSnapshot.exists()
      ) {
        setError(
          "Your CivicPulse profile could not be found."
        );

        return;
      }

      const currentProfile =
        profileSnapshot.data() as UserProfile;

      setProfile(
        currentProfile
      );

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
            "createdBy",
            "==",
            currentUser.uid
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

      const userReports: Report[] =
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

      setReports(
        userReports
      );
    } catch (err) {
      console.error(
        "My reports error:",
        err
      );

      setError(
        "Unable to load your reports."
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

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-green-500" />

          <p className="mt-4 text-gray-400">
            Loading your reports...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
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

          <p className="mt-3 leading-7 text-gray-400">
            Your account does not currently belong to a CivicPulse organisation.
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Once an organisation administrator adds you, reports created inside that organisation will appear here.
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
              Personal Reports
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              My Reports
            </h1>

            <p className="mt-2 text-gray-400">
              Reports you submitted in{" "}
              <span className="font-semibold text-gray-300">
                {profile.organizationName ||
                  "your organisation"}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/report/new"
                )
              }
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              + New Report
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-900 px-5 py-3 font-semibold hover:bg-gray-800"
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
              placeholder="Search your reports..."
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-green-500"
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
          </div>
        </section>

        <div className="mt-6">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-300">
              {
                filteredReports.length
              }
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-300">
              {
                reports.length
              }
            </span>{" "}
            reports
          </p>
        </div>

        {reports.length ===
        0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
            <div className="text-6xl">
              🗂️
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              No reports yet
            </h2>

            <p className="mt-2 text-gray-500">
              Reports you submit for this organisation will appear here.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/report/new"
                )
              }
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              Report an Issue
            </button>
          </div>
        ) : filteredReports.length ===
          0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
            <div className="text-5xl">
              🔎
            </div>

            <h2 className="mt-4 text-xl font-bold">
              No matching reports
            </h2>

            <p className="mt-2 text-gray-500">
              Try changing your filters.
            </p>
          </div>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2">
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
                  className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 text-left transition hover:border-green-600"
                >
                  {report.imageUrl ? (
                    <img
                      src={
                        report.imageUrl
                      }
                      alt={
                        report.title
                      }
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-gray-950 text-5xl">
                      📍
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1 text-xs text-gray-300">
                        {
                          report.category
                        }
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

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                          report.status
                        )}`}
                      >
                        {getStatusLabel(
                          report.status
                        )}
                      </span>
                    </div>

                    <h2 className="mt-4 text-xl font-bold">
                      {
                        report.title
                      }
                    </h2>

                    {report.description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">
                        {
                          report.description
                        }
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between border-t border-gray-800 pt-4">
                      <p className="text-sm text-gray-500">
                        ✅{" "}
                        {
                          report.confirmationCount ??
                          0
                        }{" "}
                        confirmations
                      </p>

                      <span className="font-semibold text-green-400">
                        View →
                      </span>
                    </div>
                  </div>
                </button>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}