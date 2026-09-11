/**
 * Case Escalation Service for CivicPulse.
 * Handles escalating cases, requesting escalations by assigned staff,
 * de-escalating, adding case notes, and sending escalation notifications.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { createAuditLog } from "@/src/lib/auditLog";
import { createNotification, createBulkNotifications } from "@/src/lib/notifications";

export interface EscalateCaseInput {
  reportId: string;
  organizationId: string;
  escalationLevel: number;
  escalationReason: string;
  escalatedBy: string;
  escalatedByName: string;
  escalatedByRole: string;
  assignedStaffId?: string | null;
  reportTitle?: string;
}

export interface RequestEscalationInput {
  reportId: string;
  organizationId: string;
  currentLevel?: number;
  reason: string;
  staffUid: string;
  staffName: string;
  reportTitle?: string;
}

/**
 * Escalate a case (Admin operation).
 * Updates escalationLevel (1, 2, or 3), writes case note, audit log, and notifies staff & admins.
 */
export async function escalateCase({
  reportId,
  organizationId,
  escalationLevel,
  escalationReason,
  escalatedBy,
  escalatedByName,
  escalatedByRole,
  assignedStaffId,
  reportTitle = "Report",
}: EscalateCaseInput): Promise<void> {
  const trimmedReason = escalationReason.trim();
  if (!trimmedReason) {
    throw new Error("An escalation reason is required.");
  }

  const level = Math.max(1, Math.min(3, escalationLevel));

  const reportRef = doc(db, "reports", reportId);
  await updateDoc(reportRef, {
    escalationLevel: level,
    escalated: true,
    escalationReason: trimmedReason,
    escalatedAt: serverTimestamp(),
    escalatedBy,
    updatedAt: serverTimestamp(),
  });

  // Automatically write internal case note
  try {
    await addDoc(collection(db, "reports", reportId, "caseNotes"), {
      text: `[Escalation Level ${level}]: ${trimmedReason}`,
      createdBy: escalatedBy,
      createdByName: escalatedByName,
      createdAt: serverTimestamp(),
    });
  } catch (noteErr) {
    console.warn("Failed to add escalation case note:", noteErr);
  }

  // Audit log
  await createAuditLog({
    organizationId,
    action: "report_escalated",
    entityType: "report",
    entityId: reportId,
    performedBy: escalatedBy,
    performedByName: escalatedByName,
    performedByRole: escalatedByRole,
    metadata: {
      escalationLevel: level,
      escalationReason: trimmedReason,
    },
  });

  // Notify assigned staff member if present and not the escalator
  if (assignedStaffId && assignedStaffId !== escalatedBy) {
    await createNotification({
      userId: assignedStaffId,
      createdBy: escalatedBy,
      type: "escalation",
      title: `Case Escalated (Level ${level})`,
      message: `"${reportTitle}" was escalated to Level ${level}: ${trimmedReason}`,
      reportId,
      organizationId,
    });
  }

  // Notify other admins in the organisation
  try {
    const adminsQuery = query(
      collection(db, "users"),
      where("organizationId", "==", organizationId),
      where("role", "==", "admin")
    );
    const adminDocs = await getDocs(adminsQuery);
    const adminIds = adminDocs.docs
      .map((d) => d.id)
      .filter((id) => id !== escalatedBy);

    if (adminIds.length > 0) {
      await createBulkNotifications(adminIds, {
        createdBy: escalatedBy,
        type: "escalation",
        title: `Case Escalated (Level ${level})`,
        message: `${escalatedByName} escalated "${reportTitle}" to Level ${level}: ${trimmedReason}`,
        reportId,
        organizationId,
      });
    }
  } catch (notifyErr) {
    console.warn("Failed to notify admins of escalation:", notifyErr);
  }
}

/**
 * Request escalation on an assigned case (Staff operation).
 * Sets escalationLevel, writes case note, audit log, and notifies all organisation admins.
 */
export async function requestEscalation({
  reportId,
  organizationId,
  currentLevel = 0,
  reason,
  staffUid,
  staffName,
  reportTitle = "Report",
}: RequestEscalationInput): Promise<void> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for requesting escalation.");
  }

  const newLevel = Math.min(3, Math.max(1, currentLevel + 1));

  const reportRef = doc(db, "reports", reportId);
  await updateDoc(reportRef, {
    escalationLevel: newLevel,
    escalated: true,
    escalationReason: `[Staff Request] ${trimmedReason}`,
    escalatedAt: serverTimestamp(),
    escalatedBy: staffUid,
    updatedAt: serverTimestamp(),
  });

  // Automatically write internal case note
  try {
    await addDoc(collection(db, "reports", reportId, "caseNotes"), {
      text: `[Staff Escalation Request - Level ${newLevel}]: ${trimmedReason}`,
      createdBy: staffUid,
      createdByName: staffName,
      createdAt: serverTimestamp(),
    });
  } catch (noteErr) {
    console.warn("Failed to add escalation request case note:", noteErr);
  }

  // Audit log
  await createAuditLog({
    organizationId,
    action: "report_escalated",
    entityType: "report",
    entityId: reportId,
    performedBy: staffUid,
    performedByName: staffName,
    performedByRole: "staff",
    metadata: {
      action: "escalation_requested",
      requestedLevel: newLevel,
      reason: trimmedReason,
    },
  });

  // Notify organisation admins of the request
  try {
    const adminsQuery = query(
      collection(db, "users"),
      where("organizationId", "==", organizationId),
      where("role", "==", "admin")
    );
    const adminDocs = await getDocs(adminsQuery);
    const adminIds = adminDocs.docs
      .map((d) => d.id)
      .filter((id) => id !== staffUid);

    if (adminIds.length > 0) {
      await createBulkNotifications(adminIds, {
        createdBy: staffUid,
        type: "escalation",
        title: "Escalation Requested by Staff",
        message: `${staffName} requested Level ${newLevel} escalation for "${reportTitle}": ${trimmedReason}`,
        reportId,
        organizationId,
      });
    }
  } catch (notifyErr) {
    console.warn("Failed to notify admins of staff escalation request:", notifyErr);
  }
}

/**
 * Clear or resolve escalation on a case (Admin operation).
 */
export async function clearEscalation(
  reportId: string,
  organizationId: string,
  clearedBy: string,
  clearedByName: string,
  clearedByRole: string,
  note?: string
): Promise<void> {
  const reportRef = doc(db, "reports", reportId);
  await updateDoc(reportRef, {
    escalationLevel: 0,
    escalated: false,
    escalationReason: null,
    updatedAt: serverTimestamp(),
  });

  // Add internal case note
  try {
    await addDoc(collection(db, "reports", reportId, "caseNotes"), {
      text: `[Escalation Cleared]: ${note?.trim() || "Escalation status removed."}`,
      createdBy: clearedBy,
      createdByName: clearedByName,
      createdAt: serverTimestamp(),
    });
  } catch (noteErr) {
    console.warn("Failed to add de-escalation note:", noteErr);
  }

  // Audit log
  await createAuditLog({
    organizationId,
    action: "report_escalated",
    entityType: "report",
    entityId: reportId,
    performedBy: clearedBy,
    performedByName: clearedByName,
    performedByRole: clearedByRole,
    metadata: {
      action: "escalation_cleared",
      note: note?.trim() || null,
    },
  });
}
