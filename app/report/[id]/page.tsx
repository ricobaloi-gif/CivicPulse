"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

type StatusHistoryItem = {
  status: string;
  changedAt?: Timestamp | Date;
  changedBy?: string;
};

type Report = {
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;

  latitude: number;
  longitude: number;

  imageUrl?: string | null;

  createdBy: string;
  createdByEmail?: string | null;

  confirmationCount?: number;
  confirmedBy?: string[];

  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedAt?: Timestamp | null;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  statusHistory?: StatusHistoryItem[];
};

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "verified":
      return "Verified";
    case "acknowledged":
      return "Acknowledged";
    case "assigned":
      return "Assigned";
    case "in-progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "rejected":
      return "Rejected";
    case "duplicate":
      return "Duplicate";
    case "reopened":
      return "Reopened";
    default:
      return status;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "submitted":
      return "📝";
    case "verified":
      return "✅";
    case "acknowledged":
      return "👀";
    case "assigned":
      return "👤";
    case "in-progress":
      return "🛠️";
    case "resolved":
      return "🎉";
    case "rejected":
      return "❌";
    case "duplicate":
      return "📎";
    case "reopened":
      return "🔄";
    default:
      return "●";
  }
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "submitted":
      return "bg-blue-950 text-blue-300";
    case "acknowledged":
      return "bg-purple-950 text-purple-300";
    case "assigned":
      return "bg-indigo-950 text-indigo-300";
    case "in-progress":
      return "bg-yellow-950 text-yellow-300";
    case "resolved":
      return "bg-green-950 text-green-300";
    case "reopened":
      return "bg-orange-950 text-orange-300";
    case "rejected":
      return "bg-red-950 text-red-300";
    default:
      return "bg-gray-800 text-gray-300";
  }
}

function formatTimestamp(
  value?: Timestamp | Date | null
) {
  if (!value) {
    return "Time unavailable";
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString();
  }

  return "Time unavailable";
}

export default function ReportDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const reportId = params.id as string;

  const [report, setReport] =
    useState<Report | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [staffMembers, setStaffMembers] =
    useState<UserProfile[]>([]);

  const [selectedStaffId, setSelectedStaffId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [staffLoading, setStaffLoading] =
    useState(false);

  const [confirming, setConfirming] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [assigning, setAssigning] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadReport() {
    if (!reportId) {
      return;
    }

    try {
      setLoading(true);

      const reportRef = doc(
        db,
        "reports",
        reportId
      );

      const snapshot =
        await getDoc(reportRef);

      if (!snapshot.exists()) {
        setReport(null);
        setError("Report not found.");
        return;
      }

      const data =
        snapshot.data() as Report;

      setReport(data);

      setSelectedStaffId(
        data.assignedTo ?? ""
      );
    } catch (err) {
      console.error(
        "Load report error:",
        err
      );

      setError(
        "Failed to load report."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUserProfile() {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      setProfileLoading(true);

      const userRef = doc(
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
        });

        return;
      }

      setProfile(
        snapshot.data() as UserProfile
      );
    } catch (err) {
      console.error(
        "Load user profile error:",
        err
      );

      setProfile({
        uid: user.uid,
        email: user.email ?? "",
        role: "resident",
      });
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadStaffMembers() {
    try {
      setStaffLoading(true);

      const snapshot =
        await getDocs(
          collection(
            db,
            "users"
          )
        );

      const members =
        snapshot.docs
          .map(
            (item) =>
              item.data() as UserProfile
          )
          .filter((member) => {
            const role =
              member.role
                ?.toLowerCase()
                .trim();

            return (
              role === "staff" ||
              role === "admin"
            );
          });

      members.sort((a, b) => {
        const aName =
          a.name ||
          a.email ||
          "";

        const bName =
          b.name ||
          b.email ||
          "";

        return aName.localeCompare(
          bName
        );
      });

      setStaffMembers(members);
    } catch (err) {
      console.error(
        "Load staff error:",
        err
      );

      setError(
        "Unable to load staff members."
      );
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  useEffect(() => {
    if (!authLoading) {
      loadUserProfile();
    }
  }, [
    user,
    authLoading,
  ]);

  const userRole =
    profile?.role
      ?.toLowerCase()
      .trim();

  const isStaff =
    userRole === "staff" ||
    userRole === "admin";

  useEffect(() => {
    if (isStaff) {
      loadStaffMembers();
    }
  }, [isStaff]);

  async function handleConfirm() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!report) {
      return;
    }

    if (
      report.createdBy === user.uid
    ) {
      setError(
        "You cannot confirm your own report."
      );

      return;
    }

    if (
      report.confirmedBy?.includes(
        user.uid
      )
    ) {
      setError(
        "You have already confirmed this report."
      );

      return;
    }

    try {
      setConfirming(true);
      setError("");
      setSuccess("");

      const reportRef = doc(
        db,
        "reports",
        reportId
      );

      await updateDoc(
        reportRef,
        {
          confirmationCount:
            increment(1),

          confirmedBy:
            arrayUnion(
              user.uid
            ),

          updatedAt:
            serverTimestamp(),
        }
      );

      setSuccess(
        "You confirmed this issue."
      );

      await loadReport();
    } catch (err) {
      console.error(
        "Confirm report error:",
        err
      );

      setError(
        "Failed to confirm report."
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleStatusChange(
    newStatus: string
  ) {
    if (!user) {
      setError(
        "You must be logged in."
      );
      return;
    }

    if (!isStaff) {
      setError(
        "You do not have permission to update report statuses."
      );
      return;
    }

    if (!report) {
      return;
    }

    if (
      report.status ===
      newStatus
    ) {
      setError(
        `This report is already marked as ${getStatusLabel(
          newStatus
        )}.`
      );

      return;
    }

    try {
      setUpdatingStatus(true);
      setError("");
      setSuccess("");

      const reportRef = doc(
        db,
        "reports",
        reportId
      );

      await updateDoc(
        reportRef,
        {
          status:
            newStatus,

          statusHistory:
            arrayUnion({
              status:
                newStatus,

              changedAt:
                Timestamp.now(),

              changedBy:
                user.uid,
            }),

          updatedAt:
            serverTimestamp(),
        }
      );

      setSuccess(
        `Report updated to ${getStatusLabel(
          newStatus
        )}.`
      );

      await loadReport();
    } catch (err) {
      console.error(
        "Status update error:",
        err
      );

      setError(
        "Failed to update report status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAssign() {
    if (!user) {
      setError(
        "You must be logged in."
      );
      return;
    }

    if (!isStaff) {
      setError(
        "You do not have permission to assign reports."
      );
      return;
    }

    if (!selectedStaffId) {
      setError(
        "Please choose a staff member."
      );
      return;
    }

    const selectedMember =
      staffMembers.find(
        (member) =>
          member.uid ===
          selectedStaffId
      );

    if (!selectedMember) {
      setError(
        "Selected staff member could not be found."
      );
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const reportRef = doc(
        db,
        "reports",
        reportId
      );

      const assigneeName =
        selectedMember.name?.trim() ||
        selectedMember.email ||
        "Staff Member";

      const updateData: Record<
        string,
        unknown
      > = {
        assignedTo:
          selectedStaffId,

        assignedToName:
          assigneeName,

        assignedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      };

      if (
        report?.status !==
        "assigned"
      ) {
        updateData.status =
          "assigned";

        updateData.statusHistory =
          arrayUnion({
            status:
              "assigned",

            changedAt:
              Timestamp.now(),

            changedBy:
              user.uid,
          });
      }

      await updateDoc(
        reportRef,
        updateData
      );

      setSuccess(
        `Report assigned to ${assigneeName}.`
      );

      await loadReport();
    } catch (err) {
      console.error(
        "Assign report error:",
        err
      );

      setError(
        "Failed to assign this report."
      );
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!user) {
      return;
    }

    if (!isStaff) {
      setError(
        "You do not have permission to unassign reports."
      );
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const reportRef = doc(
        db,
        "reports",
        reportId
      );

      await updateDoc(
        reportRef,
        {
          assignedTo: null,
          assignedToName: null,
          assignedAt: null,
          updatedAt:
            serverTimestamp(),
        }
      );

      setSelectedStaffId("");

      setSuccess(
        "Report assignment removed."
      );

      await loadReport();
    } catch (err) {
      console.error(
        "Unassign report error:",
        err
      );

      setError(
        "Failed to remove assignment."
      );
    } finally {
      setAssigning(false);
    }
  }

  const sortedTimeline =
    useMemo(() => {
      if (
        report?.statusHistory &&
        report.statusHistory.length >
          0
      ) {
        return report.statusHistory;
      }

      return [
        {
          status:
            report?.status ||
            "submitted",

          changedAt:
            report?.createdAt,
        },
      ];
    }, [report]);

  if (
    loading ||
    authLoading ||
    profileLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        Loading report...
      </main>
    );
  }

  if (
    error &&
    !report
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {error}
          </h1>

          <button
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!report) {
    return null;
  }

  /*
   * TypeScript-safe non-null report reference.
   * Everything below this point knows the report exists.
   */
  const currentReport: Report =
    report;

  const alreadyConfirmed =
    !!user &&
    currentReport.confirmedBy?.includes(
      user.uid
    );

  const isOwner =
    !!user &&
    currentReport.createdBy ===
      user.uid;

  function renderStatusButton(
    status: string,
    label: string
  ) {
    const isCurrent =
      currentReport.status ===
      status;

    return (
      <button
        type="button"
        disabled={
          updatingStatus ||
          isCurrent
        }
        onClick={() =>
          handleStatusChange(
            status
          )
        }
        className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold transition hover:border-blue-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCurrent
          ? `${label} ✓`
          : label}
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() =>
              router.back()
            }
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>

          {isStaff && (
            <div className="rounded-full border border-blue-800 bg-blue-950/50 px-4 py-2 text-sm font-semibold text-blue-300">
              Staff Mode
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          {currentReport.imageUrl && (
            <img
              src={
                currentReport.imageUrl
              }
              alt={
                currentReport.title
              }
              className="h-80 w-full object-cover"
            />
          )}

          <div className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-300">
                {
                  currentReport.category
                }
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm ${getStatusBadgeClasses(
                  currentReport.status
                )}`}
              >
                {getStatusLabel(
                  currentReport.status
                )}
              </span>

              <span className="rounded-full bg-red-950 px-3 py-1 text-sm text-red-300">
                {
                  currentReport.severity
                }
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-bold">
              {
                currentReport.title
              }
            </h1>

            <p className="mt-4 text-lg leading-8 text-gray-300">
              {
                currentReport.description
              }
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-800 p-5">
                <p className="text-sm text-gray-400">
                  Location
                </p>

                <p className="mt-2 font-medium">
                  {currentReport.latitude.toFixed(
                    6
                  )}
                  ,{" "}
                  {currentReport.longitude.toFixed(
                    6
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-gray-800 p-5">
                <p className="text-sm text-gray-400">
                  Confirmations
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {currentReport.confirmationCount ??
                    0}
                </p>
              </div>
            </div>

            {currentReport.assignedTo && (
              <div className="mt-6 rounded-xl border border-indigo-900 bg-indigo-950/20 p-5">
                <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
                  Assigned Case Worker
                </p>

                <p className="mt-2 text-lg font-bold">
                  {currentReport.assignedToName ||
                    "Staff Member"}
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  Assigned{" "}
                  {formatTimestamp(
                    currentReport.assignedAt
                  )}
                </p>
              </div>
            )}

            {isStaff && (
              <section className="mt-10 rounded-2xl border border-indigo-900 bg-indigo-950/20 p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
                  Case Assignment
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Assign this report
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Choose the staff member responsible for handling this case.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={
                      selectedStaffId
                    }
                    onChange={(event) =>
                      setSelectedStaffId(
                        event.target.value
                      )
                    }
                    disabled={
                      staffLoading ||
                      assigning
                    }
                    className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">
                      {staffLoading
                        ? "Loading staff..."
                        : "Choose staff member"}
                    </option>

                    {staffMembers.map(
                      (member) => (
                        <option
                          key={
                            member.uid
                          }
                          value={
                            member.uid
                          }
                        >
                          {member.name ||
                            member.email ||
                            "Staff Member"}
                          {" — "}
                          {member.role}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={
                      handleAssign
                    }
                    disabled={
                      assigning ||
                      staffLoading ||
                      !selectedStaffId
                    }
                    className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {assigning
                      ? "Saving..."
                      : currentReport.assignedTo
                      ? "Reassign"
                      : "Assign"}
                  </button>
                </div>

                {currentReport.assignedTo && (
                  <button
                    type="button"
                    onClick={
                      handleUnassign
                    }
                    disabled={
                      assigning
                    }
                    className="mt-3 text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove Assignment
                  </button>
                )}
              </section>
            )}

            {isStaff && (
              <section className="mt-6 rounded-2xl border border-blue-900 bg-blue-950/20 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                      Staff Controls
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      Manage report status
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      Every status change is added to the report timeline.
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-900 px-4 py-3">
                    <p className="text-xs text-gray-500">
                      Current Status
                    </p>

                    <p className="mt-1 font-semibold">
                      {getStatusLabel(
                        currentReport.status
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {renderStatusButton(
                    "acknowledged",
                    "👀 Acknowledge"
                  )}

                  {renderStatusButton(
                    "assigned",
                    "👤 Assigned"
                  )}

                  {renderStatusButton(
                    "in-progress",
                    "🛠️ In Progress"
                  )}

                  {renderStatusButton(
                    "resolved",
                    "✅ Resolve"
                  )}
                </div>

                {currentReport.status ===
                  "resolved" && (
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        "reopened"
                      )
                    }
                    disabled={
                      updatingStatus
                    }
                    className="mt-4 rounded-lg border border-orange-800 bg-orange-950/40 px-4 py-3 text-sm font-semibold text-orange-300 hover:bg-orange-950 disabled:opacity-50"
                  >
                    🔄 Reopen Report
                  </button>
                )}

                {updatingStatus && (
                  <p className="mt-4 text-sm text-blue-300">
                    Updating report...
                  </p>
                )}
              </section>
            )}

            <section className="mt-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">
                  Report Timeline
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Follow the progress of this issue from submission to resolution.
                </p>
              </div>

              <div>
                {sortedTimeline.map(
                  (
                    item,
                    index
                  ) => {
                    const isLast =
                      index ===
                      sortedTimeline.length -
                        1;

                    return (
                      <div
                        key={`${item.status}-${index}`}
                        className="flex gap-4"
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                              isLast
                                ? "border-blue-500 bg-blue-950"
                                : "border-gray-700 bg-gray-800"
                            } text-lg`}
                          >
                            {getStatusIcon(
                              item.status
                            )}
                          </div>

                          {!isLast && (
                            <div className="min-h-16 w-px flex-1 bg-gray-700" />
                          )}
                        </div>

                        <div
                          className={
                            isLast
                              ? "pb-2"
                              : "pb-8"
                          }
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {getStatusLabel(
                                item.status
                              )}
                            </p>

                            {isLast && (
                              <span className="rounded-full bg-blue-950 px-2 py-0.5 text-xs text-blue-300">
                                Current
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-gray-400">
                            {formatTimestamp(
                              item.changedAt
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            {error && (
              <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-6 rounded-lg border border-green-900 bg-green-950/40 p-4 text-green-300">
                {success}
              </div>
            )}

            <div className="mt-8">
              {isOwner ? (
                <div className="rounded-lg bg-gray-800 p-4 text-gray-300">
                  This is your report.
                </div>
              ) : alreadyConfirmed ? (
                <div className="rounded-lg bg-green-950 p-4 text-green-300">
                  You confirmed this issue.
                </div>
              ) : (
                <button
                  onClick={
                    handleConfirm
                  }
                  disabled={
                    confirming
                  }
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {confirming
                    ? "Confirming..."
                    : "Confirm this issue"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}