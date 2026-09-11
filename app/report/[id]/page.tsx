"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { createNotification } from "@/src/lib/notifications";
import {
  escalateCase,
  requestEscalation,
  clearEscalation,
} from "@/src/lib/escalation";
import { formatRelativeTime } from "@/src/lib/constants";
import type { Area } from "@/src/lib/types";

type StatusHistoryItem = {
  status: string;
  changedAt?: Timestamp | Date;
  changedBy?: string;
};

type Report = {
  id?: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;

  latitude: number;
  longitude: number;

  imageUrl?: string | null;

  createdBy: string;
  createdByName?: string;

  confirmationCount?: number;
  confirmedBy?: string[];

  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedAt?: Timestamp | null;

  organizationId?: string | null;
  organizationName?: string | null;

  // Area and Ward jurisdiction
  areaId?: string | null;
  areaName?: string | null;
  ward?: string | null;
  municipality?: string | null;

  // Case Escalation
  escalationLevel?: number;
  escalated?: boolean;
  escalationReason?: string | null;
  escalatedAt?: Timestamp | null;
  escalatedBy?: string | null;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  statusHistory?: StatusHistoryItem[];
};

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationRole?: string | null;
};

type CaseNote = {
  id: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp | null;
};

type PublicComment = {
  id: string;
  text: string;
  createdBy: string;
  createdByName: string;
  role: string;
  createdAt?: Timestamp | null;
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

function getSeverityBadgeClasses(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-950 text-red-300";
    case "high":
      return "bg-orange-950 text-orange-300";
    case "medium":
      return "bg-yellow-950 text-yellow-300";
    case "low":
      return "bg-green-950 text-green-300";
    default:
      return "bg-gray-800 text-gray-300";
  }
}

function getRoleBadgeClasses(role: string) {
  switch (role.toLowerCase().trim()) {
    case "admin":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "staff":
      return "border-indigo-800 bg-indigo-950/40 text-indigo-300";
    default:
      return "border-gray-700 bg-gray-800 text-gray-300";
  }
}

function getRoleLabel(role: string) {
  switch (role.toLowerCase().trim()) {
    case "admin":
      return "Admin";
    case "staff":
      return "Staff";
    default:
      return "Resident";
  }
}

function formatTimestamp(value?: Timestamp | Date | null) {
  if (!value) return "Time unavailable";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return "Time unavailable";
}

export default function ReportDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const { user, profile, loading: authLoading } = useAuth();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [orgAreas, setOrgAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");

  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [publicComments, setPublicComments] = useState<PublicComment[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newComment, setNewComment] = useState("");

  // Loading and action state
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  // Escalation state
  const [escalating, setEscalating] = useState(false);
  const [showAdminEscalateModal, setShowAdminEscalateModal] = useState(false);
  const [showStaffEscalateModal, setShowStaffEscalateModal] = useState(false);
  const [escalationLevelInput, setEscalationLevelInput] = useState(1);
  const [escalationReasonInput, setEscalationReasonInput] = useState("");
  const [staffEscalationReason, setStaffEscalationReason] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadReport = useCallback(async () => {
    if (!reportId) return;
    try {
      setLoading(true);
      const reportRef = doc(db, "reports", reportId);
      const snapshot = await getDoc(reportRef);

      if (!snapshot.exists()) {
        setReport(null);
        setError("Report not found or you do not have access to it.");
        return;
      }

      const data = { id: snapshot.id, ...snapshot.data() } as Report;
      setReport(data);
      setSelectedStaffId(data.assignedTo ?? "");
      setSelectedAreaId(data.areaId ?? "");
    } catch (err) {
      console.error("Load report error:", err);
      setReport(null);
      setError("Report not found or you do not have access to it.");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  const loadCaseNotes = useCallback(async () => {
    if (!reportId) return;
    try {
      setNotesLoading(true);
      const notesQuery = query(
        collection(db, "reports", reportId, "caseNotes"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(notesQuery);
      const notes = snapshot.docs.map((noteDoc) => ({
        id: noteDoc.id,
        ...noteDoc.data(),
      })) as CaseNote[];
      setCaseNotes(notes);
    } catch (err) {
      console.error("Load case notes error:", err);
      setError("Unable to load internal case notes.");
    } finally {
      setNotesLoading(false);
    }
  }, [reportId]);

  const loadPublicComments = useCallback(async () => {
    if (!reportId) return;
    try {
      setCommentsLoading(true);
      const commentsQuery = query(
        collection(db, "reports", reportId, "comments"),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(commentsQuery);
      const comments = snapshot.docs.map((commentDoc) => ({
        id: commentDoc.id,
        ...commentDoc.data(),
      })) as PublicComment[];
      setPublicComments(comments);
    } catch (err) {
      console.error("Load public comments error:", err);
      setError("Unable to load public comments.");
    } finally {
      setCommentsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (reportId) {
      loadReport();
      loadPublicComments();
    }
  }, [reportId, loadReport, loadPublicComments]);

  // Roles and Permissions
  const userRole = profile?.role?.toLowerCase().trim() || "resident";
  const isOwner = !!user && !!report && report.createdBy === user.uid;
  const isAssignedToMe = !!user && !!report && report.assignedTo === user.uid;
  const isStaff = userRole === "staff" || userRole === "admin";

  // Tenant check: admin is scoped to own organization
  const isAdmin =
    userRole === "admin" &&
    (!report?.organizationId || profile?.organizationId === report.organizationId);

  // Staff can ONLY manage cases assigned to them
  const canManageCase = isAdmin || (userRole === "staff" && isAssignedToMe);

  // Load staff & areas if admin
  useEffect(() => {
    if (isAdmin && report?.organizationId) {
      async function loadAdminOrgData() {
        try {
          setStaffLoading(true);
          // Staff list
          const staffSnap = await getDocs(
            query(
              collection(db, "users"),
              where("organizationId", "==", report!.organizationId)
            )
          );
          const members = staffSnap.docs
            .map((item) => ({ uid: item.id, ...item.data() } as UserProfile))
            .filter((m) => m.role === "staff" || m.role === "admin");
          members.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setStaffMembers(members);

          // Areas list
          const areasSnap = await getDocs(
            query(
              collection(db, "areas"),
              where("organizationId", "==", report!.organizationId),
              where("active", "==", true)
            )
          );
          const areas = areasSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Area)
          );
          areas.sort((a, b) => a.name.localeCompare(b.name));
          setOrgAreas(areas);
        } catch (err) {
          console.error("Load staff/areas error:", err);
        } finally {
          setStaffLoading(false);
        }
      }
      loadAdminOrgData();
    }
  }, [isAdmin, report?.organizationId]);

  useEffect(() => {
    if (canManageCase) {
      loadCaseNotes();
    } else {
      setCaseNotes([]);
    }
  }, [canManageCase, loadCaseNotes]);

  // Citizen confirmation
  async function handleConfirm() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!report) return;

    if (report.createdBy === user.uid) {
      setError("You cannot confirm your own report.");
      return;
    }
    if (report.confirmedBy?.includes(user.uid)) {
      setError("You have already confirmed this report.");
      return;
    }

    try {
      setConfirming(true);
      setError("");
      setSuccess("");

      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        confirmationCount: increment(1),
        confirmedBy: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });

      if (report.createdBy !== user.uid) {
        await createNotification({
          userId: report.createdBy,
          createdBy: user.uid,
          type: "confirmation",
          title: "Report Confirmed",
          message: `Someone confirmed your report "${report.title}".`,
          reportId,
        });
      }

      setSuccess("You confirmed this issue.");
      await loadReport();
    } catch (err) {
      console.error("Confirm report error:", err);
      setError("Failed to confirm report.");
    } finally {
      setConfirming(false);
    }
  }

  // Status transition
  async function handleStatusChange(newStatus: string) {
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    if (!canManageCase) {
      setError("You do not have permission to update this case.");
      return;
    }
    if (!report) return;

    if (report.status === newStatus) {
      setError(`This report is already marked as ${getStatusLabel(newStatus)}.`);
      return;
    }

    try {
      setUpdatingStatus(true);
      setError("");
      setSuccess("");

      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        status: newStatus,
        statusHistory: arrayUnion({
          status: newStatus,
          changedAt: Timestamp.now(),
          changedBy: user.uid,
        }),
        updatedAt: serverTimestamp(),
      });

      if (report.createdBy !== user.uid) {
        await createNotification({
          userId: report.createdBy,
          createdBy: user.uid,
          type: "status",
          title: "Report Status Updated",
          message: `Your report "${report.title}" is now ${getStatusLabel(newStatus)}.`,
          reportId,
        });
      }

      setSuccess(`Report updated to ${getStatusLabel(newStatus)}.`);
      await loadReport();
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update report status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Admin Case Assignment
  async function handleAssign() {
    if (!user || !isAdmin || !report) return;

    if (!selectedStaffId) {
      setError("Please choose a staff member.");
      return;
    }

    const selectedMember = staffMembers.find((m) => m.uid === selectedStaffId);
    if (!selectedMember) {
      setError("Selected staff member could not be found.");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const assigneeName = selectedMember.name?.trim() || "Staff Member";
      const reportRef = doc(db, "reports", reportId);

      const updateData: Record<string, unknown> = {
        assignedTo: selectedStaffId,
        assignedToName: assigneeName,
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (report.status !== "assigned") {
        updateData.status = "assigned";
        updateData.statusHistory = arrayUnion({
          status: "assigned",
          changedAt: Timestamp.now(),
          changedBy: user.uid,
        });
      }

      await updateDoc(reportRef, updateData);

      if (selectedStaffId !== user.uid) {
        await createNotification({
          userId: selectedStaffId,
          createdBy: user.uid,
          type: "assignment",
          title: "New Case Assigned",
          message: `You have been assigned the report "${report.title}".`,
          reportId,
        });
      }

      setSuccess(`Report assigned to ${assigneeName}.`);
      await loadReport();
    } catch (err) {
      console.error("Assign report error:", err);
      setError("Failed to assign this report.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!user || !isAdmin || !report) return;

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        assignedTo: null,
        assignedToName: null,
        assignedAt: null,
        updatedAt: serverTimestamp(),
      });

      setSelectedStaffId("");
      setSuccess("Report assignment removed.");
      await loadReport();
    } catch (err) {
      console.error("Unassign error:", err);
      setError("Failed to remove assignment.");
    } finally {
      setAssigning(false);
    }
  }

  // Admin Area / Ward assignment
  async function handleUpdateArea() {
    if (!user || !isAdmin || !report || !report.organizationId) return;

    try {
      setSavingArea(true);
      setError("");
      setSuccess("");

      const chosenArea = orgAreas.find((a) => a.id === selectedAreaId);
      const reportRef = doc(db, "reports", reportId);

      const areaUpdates: Record<string, unknown> = {
        areaId: chosenArea ? chosenArea.id : null,
        areaName: chosenArea ? chosenArea.name : null,
        ward: chosenArea
          ? chosenArea.type === "ward"
            ? chosenArea.code || chosenArea.name
            : chosenArea.code || null
          : null,
        municipality: chosenArea?.municipality || null,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(reportRef, areaUpdates);
      setSuccess(
        chosenArea
          ? `Area set to "${chosenArea.name}".`
          : "Area assignment removed."
      );
      await loadReport();
    } catch (err) {
      console.error("Update area error:", err);
      setError("Failed to update report area.");
    } finally {
      setSavingArea(false);
    }
  }

  // Case Escalation (Admin)
  async function handleAdminEscalateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isAdmin || !report || !report.organizationId) return;

    const trimmedReason = escalationReasonInput.trim();
    if (!trimmedReason) {
      setError("Please provide an escalation reason.");
      return;
    }

    try {
      setEscalating(true);
      setError("");
      setSuccess("");

      await escalateCase({
        reportId,
        organizationId: report.organizationId,
        escalationLevel: escalationLevelInput,
        escalationReason: trimmedReason,
        escalatedBy: user.uid,
        escalatedByName: profile?.name || user.email || "Admin",
        escalatedByRole: profile?.role || "admin",
        assignedStaffId: report.assignedTo,
        reportTitle: report.title,
      });

      setSuccess(`Case escalated to Level ${escalationLevelInput}.`);
      setShowAdminEscalateModal(false);
      setEscalationReasonInput("");
      await loadReport();
      await loadCaseNotes();
    } catch (err: unknown) {
      console.error("Escalation error:", err);
      setError(err instanceof Error ? err.message : "Failed to escalate case.");
    } finally {
      setEscalating(false);
    }
  }

  // Clear Escalation (Admin)
  async function handleAdminClearEscalation() {
    if (!user || !isAdmin || !report || !report.organizationId) return;
    if (!confirm("Are you sure you want to clear the escalation status on this case?")) {
      return;
    }

    try {
      setEscalating(true);
      setError("");
      setSuccess("");

      await clearEscalation(
        reportId,
        report.organizationId,
        user.uid,
        profile?.name || user.email || "Admin",
        profile?.role || "admin",
        "Issue de-escalated / resolved"
      );

      setSuccess("Escalation resolved and cleared.");
      await loadReport();
      await loadCaseNotes();
    } catch (err: unknown) {
      console.error("Clear escalation error:", err);
      setError(err instanceof Error ? err.message : "Failed to clear escalation.");
    } finally {
      setEscalating(false);
    }
  }

  // Staff Request Escalation
  async function handleStaffRequestEscalateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !report || !report.organizationId || !isAssignedToMe) return;

    const trimmedReason = staffEscalationReason.trim();
    if (!trimmedReason) {
      setError("Please provide a reason for requesting escalation.");
      return;
    }

    try {
      setEscalating(true);
      setError("");
      setSuccess("");

      await requestEscalation({
        reportId,
        organizationId: report.organizationId,
        currentLevel: report.escalationLevel || 0,
        reason: trimmedReason,
        staffUid: user.uid,
        staffName: profile?.name || user.email || "Staff Member",
        reportTitle: report.title,
      });

      setSuccess("Escalation requested. Organisation administrators have been notified.");
      setShowStaffEscalateModal(false);
      setStaffEscalationReason("");
      await loadReport();
      await loadCaseNotes();
    } catch (err: unknown) {
      console.error("Staff escalation error:", err);
      setError(err instanceof Error ? err.message : "Failed to request escalation.");
    } finally {
      setEscalating(false);
    }
  }

  // Internal case note
  async function handleAddCaseNote() {
    if (!user || !canManageCase) return;
    const trimmed = newNote.trim();
    if (!trimmed) {
      setError("Please write a case note first.");
      return;
    }

    try {
      setAddingNote(true);
      setError("");
      setSuccess("");

      await addDoc(collection(db, "reports", reportId, "caseNotes"), {
        text: trimmed,
        createdBy: user.uid,
        createdByName: profile?.name?.trim() || "Staff Member",
        createdAt: serverTimestamp(),
      });

      setNewNote("");
      setSuccess("Internal case note added.");
      await loadCaseNotes();
    } catch (err) {
      console.error("Add note error:", err);
      setError("Failed to add the case note.");
    } finally {
      setAddingNote(false);
    }
  }

  // Public comment
  async function handleAddComment() {
    if (!user || !report) return;
    const trimmed = newComment.trim();
    if (!trimmed) {
      setError("Please write a comment first.");
      return;
    }

    try {
      setAddingComment(true);
      setError("");
      setSuccess("");

      const authorName = profile?.name?.trim() || "CivicPulse User";

      await addDoc(collection(db, "reports", reportId, "comments"), {
        text: trimmed,
        createdBy: user.uid,
        createdByName: authorName,
        role: userRole,
        createdAt: serverTimestamp(),
      });

      if (report.createdBy !== user.uid) {
        await createNotification({
          userId: report.createdBy,
          createdBy: user.uid,
          type: "comment",
          title: "New Comment",
          message: `${authorName} commented on your report "${report.title}".`,
          reportId,
        });
      }

      setNewComment("");
      setSuccess("Comment posted.");
      await loadPublicComments();
    } catch (err) {
      console.error("Add comment error:", err);
      setError("Failed to post comment.");
    } finally {
      setAddingComment(false);
    }
  }

  const sortedTimeline = useMemo(() => {
    if (report?.statusHistory && report.statusHistory.length > 0) {
      return report.statusHistory;
    }
    return [{ status: report?.status || "submitted", changedAt: report?.createdAt }];
  }, [report]);

  if (loading || authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
          <p className="mt-4 text-gray-400">Loading report...</p>
        </div>
      </main>
    );
  }

  if (error && !report) {
    return (
      <Layout title="Report Not Found">
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold text-white">{error}</h1>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  if (!report) return null;

  const alreadyConfirmed =
    !!user && report.confirmedBy?.includes(user.uid);

  const escalationLevel = report.escalationLevel || 0;
  const isEscalated = escalationLevel > 0;

  function renderStatusButton(statusVal: string, label: string) {
    const isCurrent = report!.status === statusVal;
    return (
      <button
        type="button"
        disabled={updatingStatus || isCurrent}
        onClick={() => handleStatusChange(statusVal)}
        className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold transition hover:border-blue-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCurrent ? `${label} ✓` : label}
      </button>
    );
  }

  return (
    <Layout title={report.title || "Report Details"}>
      <div className="mx-auto max-w-4xl">
        {/* Navigation & Badges */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {isAssignedToMe && (
              <span className="rounded-full border border-indigo-800 bg-indigo-950/50 px-4 py-1.5 text-xs font-semibold text-indigo-300">
                Assigned to You
              </span>
            )}

            {isStaff && (
              <span className="rounded-full border border-blue-800 bg-blue-950/50 px-4 py-1.5 text-xs font-semibold text-blue-300">
                {isAdmin ? "Admin Mode" : "Staff Mode"}
              </span>
            )}
          </div>
        </div>

        {/* Escalation Alert Banner */}
        {isEscalated && (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🔺</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-red-200">
                      Case Escalated — Level {escalationLevel}
                    </h2>
                    <span className="rounded-full border border-red-700 bg-red-900/60 px-2.5 py-0.5 text-xs font-bold uppercase text-red-300">
                      {escalationLevel === 3
                        ? "Urgent / Critical"
                        : escalationLevel === 2
                        ? "Manager"
                        : "Supervisor"}
                    </span>
                  </div>
                  {report.escalationReason && (
                    <p className="mt-1 text-sm text-red-300">
                      Reason: {report.escalationReason}
                    </p>
                  )}
                  {report.escalatedAt && (
                    <p className="mt-1 text-xs text-red-400">
                      Escalated {formatRelativeTime(report.escalatedAt)}
                    </p>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEscalationLevelInput(escalationLevel);
                      setEscalationReasonInput(report.escalationReason || "");
                      setShowAdminEscalateModal(true);
                    }}
                    className="rounded-lg border border-red-700 bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900"
                  >
                    Change Level
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminClearEscalation}
                    disabled={escalating}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                  >
                    Clear Escalation
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          {report.imageUrl && (
            <img
              src={report.imageUrl}
              alt={report.title}
              className="h-80 w-full object-cover"
            />
          )}

          <div className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-300">
                {report.category}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm ${getStatusBadgeClasses(
                  report.status
                )}`}
              >
                {getStatusLabel(report.status)}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm capitalize ${getSeverityBadgeClasses(
                  report.severity
                )}`}
              >
                {report.severity}
              </span>

              {report.areaName && (
                <span className="rounded-full border border-indigo-900 bg-indigo-950/40 px-3 py-1 text-xs text-indigo-300">
                  📍 {report.areaName}
                </span>
              )}

              {report.ward && (
                <span className="rounded-full border border-blue-900 bg-blue-950/40 px-3 py-1 text-xs text-blue-300">
                  🏛️ {report.ward}
                </span>
              )}
            </div>

            <h1 className="mt-5 text-3xl font-bold sm:text-4xl text-white">
              {report.title}
            </h1>

            <p className="mt-4 text-base leading-7 text-gray-300">
              {report.description}
            </p>

            {/* Metadata info grid */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-800/80 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Coordinates
                </p>
                <p className="mt-1 font-mono text-sm">
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-800/80 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Confirmations
                </p>
                <p className="mt-1 text-xl font-bold">
                  {report.confirmationCount ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-gray-800/80 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Service Area
                </p>
                <p className="mt-1 text-sm font-semibold truncate">
                  {report.areaName || report.ward || "Unassigned area"}
                </p>
              </div>

              <div className="rounded-xl bg-gray-800/80 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Municipality
                </p>
                <p className="mt-1 text-sm font-semibold truncate">
                  {report.municipality || "Not specified"}
                </p>
              </div>
            </div>

            {/* Assigned Case Worker Card */}
            {report.assignedTo && (
              <div className="mt-6 rounded-xl border border-indigo-900 bg-indigo-950/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Assigned Case Worker
                </p>
                <p className="mt-1 text-lg font-bold">
                  {report.assignedToName || "Staff Member"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Assigned {formatTimestamp(report.assignedAt)}
                </p>
              </div>
            )}

            {/* Admin Area & Jurisdiction Assignment */}
            {isAdmin && (
              <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-950/50 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Area Assignment
                </p>
                <h2 className="mt-1 text-xl font-bold">Service Area &amp; Ward</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Assign this report to a defined service area or ward for territory routing.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">-- No Specific Area / Unassigned --</option>
                    {orgAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}){a.code ? ` - ${a.code}` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleUpdateArea}
                    disabled={savingArea}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savingArea ? "Saving..." : "Save Area"}
                  </button>
                </div>
              </section>
            )}

            {/* Admin Staff Assignment */}
            {isAdmin && (
              <section className="mt-6 rounded-2xl border border-indigo-900 bg-indigo-950/20 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Staff Dispatch
                </p>
                <h2 className="mt-1 text-xl font-bold">Assign this report</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Assign a team member from your organisation to resolve this report.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={staffLoading || assigning}
                    className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">
                      {staffLoading ? "Loading staff..." : "-- Choose staff member --"}
                    </option>
                    {staffMembers.map((member) => (
                      <option key={member.uid} value={member.uid}>
                        {member.name || member.email} ({member.role})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={assigning || staffLoading || !selectedStaffId}
                    className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {assigning
                      ? "Saving..."
                      : report.assignedTo
                      ? "Reassign"
                      : "Assign"}
                  </button>
                </div>

                {report.assignedTo && (
                  <button
                    type="button"
                    onClick={handleUnassign}
                    disabled={assigning}
                    className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove Assignment
                  </button>
                )}
              </section>
            )}

            {/* Case Controls & Escalation Actions */}
            {canManageCase && (
              <section className="mt-6 rounded-2xl border border-blue-900 bg-blue-950/20 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      Workflow Actions
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Manage Report Status</h2>
                    {!isAdmin && (
                      <p className="mt-1 text-xs text-gray-400">
                        You can update this case because it is assigned to you.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-900 px-4 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      Current Status
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {getStatusLabel(report.status)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {renderStatusButton("acknowledged", "👀 Acknowledge")}
                  {renderStatusButton("assigned", "👤 Assigned")}
                  {renderStatusButton("in-progress", "🛠️ In Progress")}
                  {renderStatusButton("resolved", "✅ Resolve")}
                </div>

                {report.status === "resolved" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("reopened")}
                    disabled={updatingStatus}
                    className="mt-4 rounded-lg border border-orange-800 bg-orange-950/40 px-4 py-2.5 text-xs font-semibold text-orange-300 hover:bg-orange-950 disabled:opacity-50"
                  >
                    🔄 Reopen Report
                  </button>
                )}

                {/* Escalation Action Button */}
                <div className="mt-6 border-t border-gray-800/80 pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-300">
                      Need urgent attention or manager intervention?
                    </p>
                    <p className="text-xs text-gray-500">
                      Escalating updates the priority and sends notification alerts.
                    </p>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEscalationLevelInput(isEscalated ? escalationLevel : 1);
                        setEscalationReasonInput(report.escalationReason || "");
                        setShowAdminEscalateModal(true);
                      }}
                      className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-900"
                    >
                      {isEscalated ? "Update Escalation Level" : "🔺 Escalate Case"}
                    </button>
                  ) : (
                    isAssignedToMe && (
                      <button
                        type="button"
                        onClick={() => setShowStaffEscalateModal(true)}
                        className="rounded-lg border border-orange-800 bg-orange-950/40 px-4 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-900"
                      >
                        🔺 Request Escalation
                      </button>
                    )
                  )}
                </div>
              </section>
            )}

            {/* Internal Case Notes (Staff & Admin Only) */}
            {canManageCase && (
              <section className="mt-6 rounded-2xl border border-emerald-900 bg-emerald-950/10 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Internal Activity Notes
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Case Notes</h2>
                    <p className="mt-1 text-xs text-gray-400">
                      Private operational log for staff and admins. Not visible to residents.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                    Private
                  </span>
                </div>

                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Add an internal case note..."
                  className="mt-4 w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddCaseNote}
                    disabled={addingNote || !newNote.trim()}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {addingNote ? "Adding..." : "Add Case Note"}
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {notesLoading ? (
                    <p className="text-xs text-gray-400">Loading notes...</p>
                  ) : caseNotes.length === 0 ? (
                    <p className="text-xs text-gray-500">No internal notes yet.</p>
                  ) : (
                    caseNotes.map((note) => (
                      <article
                        key={note.id}
                        className="rounded-xl border border-gray-800 bg-gray-950 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-300">
                            {note.createdByName}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatTimestamp(note.createdAt)}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                          {note.text}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Public Community Discussion */}
            <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-950/40 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                Community Discussion
              </p>
              <h2 className="mt-1 text-xl font-bold">Public Comments</h2>
              <p className="mt-1 text-xs text-gray-400">
                Residents and CivicPulse staff can discuss this report publicly.
              </p>

              {user && (
                <div className="mt-5">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Add a public comment..."
                    className="w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-purple-500"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className="rounded-lg bg-purple-600 px-5 py-2.5 text-xs font-semibold hover:bg-purple-500 disabled:opacity-50"
                    >
                      {addingComment ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {commentsLoading ? (
                  <p className="text-xs text-gray-400">Loading comments...</p>
                ) : publicComments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-xs text-gray-500">
                    No comments yet. Be the first to share an update or question.
                  </div>
                ) : (
                  publicComments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-xl border border-gray-800 bg-gray-900 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{comment.createdByName}</p>
                        <span
                          className={`rounded-full border px-2 py-0.2 text-[10px] ${getRoleBadgeClasses(
                            comment.role
                          )}`}
                        >
                          {getRoleLabel(comment.role)}
                        </span>
                        <span className="text-xs text-gray-500">
                          • {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">
                        {comment.text}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            {/* Timeline */}
            <section className="mt-8">
              <h2 className="text-xl font-bold">Report Timeline</h2>
              <div className="mt-4">
                {sortedTimeline.map((item, index) => {
                  const isLast = index === sortedTimeline.length - 1;
                  return (
                    <div key={`${item.status}-${index}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                            isLast
                              ? "border-blue-500 bg-blue-950 text-blue-300"
                              : "border-gray-700 bg-gray-800"
                          }`}
                        >
                          {getStatusIcon(item.status)}
                        </div>
                        {!isLast && <div className="min-h-12 w-px flex-1 bg-gray-700" />}
                      </div>
                      <div className="pb-6">
                        <p className="text-sm font-semibold">
                          {getStatusLabel(item.status)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatTimestamp(item.changedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Error / Success feedback */}
            {error && (
              <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-6 rounded-xl border border-green-900 bg-green-950/40 p-4 text-sm text-green-300">
                {success}
              </div>
            )}

            {/* Citizen Confirmation Action */}
            <div className="mt-8">
              {isOwner ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-400">
                  ℹ️ You submitted this report.
                </div>
              ) : alreadyConfirmed ? (
                <div className="rounded-xl border border-green-900/60 bg-green-950/30 p-4 text-xs font-semibold text-green-300">
                  👍 You confirmed this issue.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {confirming ? "Confirming..." : "👍 Confirm this issue"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Admin Escalation Modal */}
        {showAdminEscalateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-gray-900 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">🔺 Escalate Case</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminEscalateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAdminEscalateSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Escalation Level
                  </label>
                  <select
                    value={escalationLevelInput}
                    onChange={(e) => setEscalationLevelInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm outline-none focus:border-red-500"
                  >
                    <option value={1}>Level 1: Supervisor Intervention</option>
                    <option value={2}>Level 2: Manager / Department Review</option>
                    <option value={3}>Level 3: Critical / Emergency Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Reason for Escalation *
                  </label>
                  <textarea
                    value={escalationReasonInput}
                    onChange={(e) => setEscalationReasonInput(e.target.value)}
                    required
                    rows={3}
                    placeholder="e.g. Severe safety risk, prolonged SLA breach, or contractor required..."
                    className="mt-1 w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminEscalateModal(false)}
                    className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={escalating || !escalationReasonInput.trim()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {escalating ? "Escalating..." : "Confirm Escalation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Staff Request Escalation Modal */}
        {showStaffEscalateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-orange-900 bg-gray-900 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  🔺 Request Case Escalation
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStaffEscalateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-400">
                Submit an escalation request to organisation administrators detailing why this case requires additional resources or senior oversight.
              </p>

              <form onSubmit={handleStaffRequestEscalateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Reason / Blockers *
                  </label>
                  <textarea
                    value={staffEscalationReason}
                    onChange={(e) => setStaffEscalationReason(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe why this case needs escalation (e.g. specialist equipment needed, health hazard, boundary dispute)..."
                    className="mt-1 w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStaffEscalateModal(false)}
                    className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={escalating || !staffEscalationReason.trim()}
                    className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                  >
                    {escalating ? "Submitting..." : "Submit Escalation Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
