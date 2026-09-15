import { NextRequest } from "next/server";
import { FieldValue, DocumentSnapshot, Query } from "firebase-admin/firestore";
import { validateApiKey } from "@/src/lib/apiAuth";
import { checkRateLimit, addRateLimitHeaders, createRateLimitedResponse } from "@/src/lib/rateLimit";
import { success, error, validationError, unauthorized, notFound, internalError, forbidden } from "@/src/lib/apiResponse";
import { STATUSES, SEVERITIES, MODERATION_REASONS, MODERATION_STATUSES, DISPUTE_STATUSES } from "@/src/lib/constants";
import { adminDb } from "@/src/lib/apiAuth";
import type { ReportStatus, ModerationStatus, DisputeStatus } from "@/src/lib/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(STATUSES);
const VALID_SEVERITIES = new Set(SEVERITIES);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ["acknowledged", "assigned", "rejected", "duplicate"],
  acknowledged: ["assigned", "in-progress", "rejected", "duplicate"],
  assigned: ["in-progress", "rejected", "duplicate", "submitted"],
  "in-progress": ["resolved", "rejected", "duplicate", "assigned"],
  resolved: ["verified", "reopened"],
  verified: ["reopened"],
  reopened: ["assigned", "in-progress", "resolved", "rejected"],
  rejected: ["submitted", "duplicate"],
  duplicate: [],
};

function sanitizeReport(doc: DocumentSnapshot, includePrivate = false): Record<string, unknown> {
  const data = doc.data() as Record<string, unknown> | undefined;
  if (!data) return { id: doc.id };

  const report: Record<string, unknown> = {
    id: doc.id,
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    status: data.status,
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
    areaId: data.areaId,
    areaName: data.areaName,
    ward: data.ward,
    municipality: data.municipality,
    imageUrl: data.imageUrl,
    confirmationCount: data.confirmationCount || 0,
    assignedTo: data.assignedTo,
    assignedToName: data.assignedToName,
    escalationLevel: data.escalationLevel || 0,
    createdAt: (data.createdAt as any)?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: (data.updatedAt as any)?.toDate?.()?.toISOString() || data.updatedAt,
    submittedAt: (data.submittedAt as any)?.toDate?.()?.toISOString() || data.submittedAt,
    acknowledgedAt: (data.acknowledgedAt as any)?.toDate?.()?.toISOString() || data.acknowledgedAt,
  };

  if (includePrivate) {
    report.createdBy = data.createdBy;
    report.createdByName = data.createdByName;
    report.organizationId = data.organizationId;
    report.organizationName = data.organizationName;
    report.confirmedBy = data.confirmedBy;
    report.assignedAt = (data.assignedAt as any)?.toDate?.()?.toISOString() || data.assignedAt;
    report.priority = data.priority;
    report.escalated = data.escalated;
    report.escalatedAt = (data.escalatedAt as any)?.toDate?.()?.toISOString() || data.escalatedAt;
    report.escalatedBy = data.escalatedBy;
    report.escalationReason = data.escalationReason;
    report.resolutionNote = data.resolutionNote;
    report.resolvedAt = (data.resolvedAt as any)?.toDate?.()?.toISOString() || data.resolvedAt;
    report.resolvedBy = data.resolvedBy;
    report.resolutionImageUrls = data.resolutionImageUrls;
    report.moderationStatus = data.moderationStatus;
    report.disputeStatus = data.disputeStatus;
    report.statusHistory = data.statusHistory;
  }

  return report;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, `/api/reports/${id}`, "GET");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  try {
    const reportRef = adminDb.collection("reports").doc(id);
    const snapshot = await reportRef.get();

    if (!snapshot.exists) {
      return notFound("Report not found");
    }

    const reportData = snapshot.data() as Record<string, unknown> | undefined;
    if (!reportData || reportData.organizationId !== organizationId) {
      return notFound("Report not found");
    }

    const report = sanitizeReport(snapshot, true);

    const response = success({ report });
    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("GET /api/reports/[id] error:", err);
    return internalError("Failed to fetch report");
  }
}

interface UpdateReportInput {
  status?: string;
  assignedTo?: string | null;
  priority?: number;
  escalationLevel?: number;
  areaId?: string | null;
  resolutionNote?: string;
  resolutionImageUrls?: string[];
  moderationStatus?: string;
  moderationReason?: string | null;
  disputeStatus?: string;
  disputeReason?: string | null;
}

function validateUpdateReport(body: unknown): { valid: boolean; data?: UpdateReportInput; errors?: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !VALID_STATUSES.has(b.status as ReportStatus)) {
      errors.push(`Invalid status. Must be one of: ${STATUSES.join(", ")}`);
    }
  }

  if (b.assignedTo !== undefined) {
    if (b.assignedTo !== null && (typeof b.assignedTo !== "string" || b.assignedTo.length > 100)) {
      errors.push("assignedTo must be a string or null");
    }
  }

  if (b.priority !== undefined) {
    if (typeof b.priority !== "number" || b.priority < 0 || b.priority > 10) {
      errors.push("Priority must be a number between 0 and 10");
    }
  }

  if (b.escalationLevel !== undefined) {
    if (typeof b.escalationLevel !== "number" || b.escalationLevel < 0 || b.escalationLevel > 3) {
      errors.push("Escalation level must be a number between 0 and 3");
    }
  }

  if (b.areaId !== undefined) {
    if (b.areaId !== null && (typeof b.areaId !== "string" || b.areaId.length > 100)) {
      errors.push("Area ID must be a string or null");
    }
  }

  if (b.resolutionNote !== undefined) {
    if (b.resolutionNote !== null && (typeof b.resolutionNote !== "string" || b.resolutionNote.length > 5000)) {
      errors.push("Resolution note must be a string (max 5000 characters) or null");
    }
  }

  if (b.resolutionImageUrls !== undefined) {
    if (b.resolutionImageUrls !== null && (!Array.isArray(b.resolutionImageUrls) || b.resolutionImageUrls.length > 10)) {
      errors.push("Resolution image URLs must be an array (max 10 images)");
    } else if (Array.isArray(b.resolutionImageUrls)) {
      for (const url of b.resolutionImageUrls) {
        if (typeof url !== "string" || !url.startsWith("http")) {
          errors.push("Each resolution image URL must be a valid HTTP/HTTPS URL");
          break;
        }
      }
    }
  }

  if (b.moderationStatus !== undefined) {
    if (b.moderationStatus !== null && (typeof b.moderationStatus !== "string" || !MODERATION_STATUSES.includes(b.moderationStatus as ModerationStatus))) {
      errors.push(`Invalid moderation status. Must be one of: ${MODERATION_STATUSES.join(", ")}`);
    }
  }

  if (b.moderationReason !== undefined) {
    if (b.moderationReason !== null && (typeof b.moderationReason !== "string" || !MODERATION_REASONS.includes(b.moderationReason as typeof MODERATION_REASONS[number]))) {
      errors.push(`Invalid moderation reason. Must be one of: ${MODERATION_REASONS.join(", ")}`);
    }
  }

  if (b.disputeStatus !== undefined) {
    if (b.disputeStatus !== null && (typeof b.disputeStatus !== "string" || !DISPUTE_STATUSES.includes(b.disputeStatus as DisputeStatus))) {
      errors.push(`Invalid dispute status. Must be one of: ${DISPUTE_STATUSES.join(", ")}`);
    }
  }

  if (b.disputeReason !== undefined) {
    if (b.disputeReason !== null && (typeof b.disputeReason !== "string" || b.disputeReason.length > 5000)) {
      errors.push("Dispute reason must be a string (max 5000 characters) or null");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      status: b.status as string | undefined,
      assignedTo: (b.assignedTo as string | null | undefined) ?? undefined,
      priority: b.priority as number | undefined,
      escalationLevel: b.escalationLevel as number | undefined,
      areaId: b.areaId as string | undefined,
      resolutionNote: b.resolutionNote as string | undefined,
      resolutionImageUrls: b.resolutionImageUrls as string[] | undefined,
      moderationStatus: b.moderationStatus as string | undefined,
      moderationReason: b.moderationReason as string | undefined,
      disputeStatus: b.disputeStatus as string | undefined,
      disputeReason: b.disputeReason as string | undefined,
    },
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, `/api/reports/${id}`, "PATCH");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  const validation = validateUpdateReport(body);
  if (!validation.valid) {
    return validationError("Validation failed", { errors: validation.errors });
  }

  const updates = validation.data!;

  try {
    const reportRef = adminDb.collection("reports").doc(id);
    const snapshot = await reportRef.get();

    if (!snapshot.exists) {
      return notFound("Report not found");
    }

    const reportData = snapshot.data() as Record<string, unknown> | undefined;
    if (!reportData || reportData.organizationId !== organizationId) {
      return notFound("Report not found");
    }

    const currentStatus = reportData.status as string;
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (updates.status !== undefined && updates.status !== currentStatus) {
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(updates.status)) {
        return validationError(
          `Invalid status transition from ${currentStatus} to ${updates.status}. Allowed: ${allowedTransitions.join(", ") || "none"}`
        );
      }

      updateData.status = updates.status;
      const existingHistory = (reportData.statusHistory as Array<{ status: string; changedAt: Date; changedBy: string }>) || [];
      updateData.statusHistory = [
        ...existingHistory,
        {
          status: updates.status,
          changedAt: new Date(),
          changedBy: apiKey.createdBy,
        },
      ];

      const now = new Date();
      if (updates.status === "acknowledged" && !reportData.acknowledgedAt) {
        updateData.acknowledgedAt = now;
      }
      if (updates.status === "assigned" && !reportData.assignedAt) {
        updateData.assignedAt = now;
      }
      if (updates.status === "in-progress" && !reportData.workStartedAt) {
        updateData.workStartedAt = now;
      }
      if (updates.status === "resolved") {
        updateData.resolvedAt = now;
        updateData.resolvedBy = apiKey.createdBy;
      }
    }

    if (updates.assignedTo !== undefined) {
      updateData.assignedTo = updates.assignedTo;
      if (updates.assignedTo) {
        updateData.assignedAt = new Date();
      } else {
        updateData.assignedAt = null;
        updateData.assignedToName = null;
      }
    }

    if (updates.priority !== undefined) {
      updateData.priority = updates.priority;
    }

    if (updates.escalationLevel !== undefined) {
      updateData.escalationLevel = updates.escalationLevel;
      updateData.escalated = updates.escalationLevel > 0;
      if (updates.escalationLevel > 0 && !reportData.escalatedAt) {
        updateData.escalatedAt = new Date();
        updateData.escalatedBy = apiKey.createdBy;
      }
    }

    if (updates.areaId !== undefined) {
      updateData.areaId = updates.areaId;
      if (updates.areaId) {
        const areaDoc = await adminDb.collection("areas").doc(updates.areaId).get();
        if (areaDoc.exists) {
          const areaData = areaDoc.data() as Record<string, unknown> | undefined;
          if (areaData && areaData.organizationId === organizationId) {
            updateData.areaName = areaData.name;
            updateData.ward = areaData.type === "ward" ? areaData.code || areaData.name : areaData.code || null;
            updateData.municipality = areaData.municipality || null;
          }
        }
      } else {
        updateData.areaName = null;
        updateData.ward = null;
        updateData.municipality = null;
      }
    }

    if (updates.resolutionNote !== undefined) {
      updateData.resolutionNote = updates.resolutionNote;
    }

    if (updates.resolutionImageUrls !== undefined) {
      updateData.resolutionImageUrls = updates.resolutionImageUrls;
    }

    const isAdmin = apiKey.permissions.includes("moderateReports") || apiKey.permissions.includes("*");
    const isCreator = reportData.createdBy === apiKey.createdBy;

    // Dispute handling
    if (updates.disputeStatus !== undefined || updates.disputeReason !== undefined) {
      const currentDisputeStatus = reportData.disputeStatus as string || "none";
      const currentReportStatus = reportData.status as string;

      // Only report creator can submit a dispute
      if (!isCreator) {
        return forbidden("Only the report creator can submit a dispute");
      }

      // Can only dispute resolved/verified reports
      if (!["resolved", "verified"].includes(currentReportStatus)) {
        return validationError("Can only dispute resolved or verified reports");
      }

      // Can only submit dispute if no active dispute
      if (updates.disputeStatus === "submitted" && currentDisputeStatus !== "none") {
        return validationError("A dispute has already been submitted for this report");
      }

      // Handle dispute submission
      if (updates.disputeStatus === "submitted") {
        updateData.disputeStatus = "submitted";
        updateData.disputedAt = new Date();
        updateData.disputedBy = apiKey.createdBy;
        if (updates.disputeReason !== undefined) {
          updateData.disputeReason = updates.disputeReason;
        }
        // Add to status history
        const existingHistory = (reportData.statusHistory as Array<{ status: string; changedAt: Date; changedBy: string }>) || [];
        updateData.statusHistory = [
          ...existingHistory,
          {
            status: "disputed",
            changedAt: new Date(),
            changedBy: apiKey.createdBy,
          },
        ];
      }
    }

    // Admin dispute review
    if (isAdmin && (updates.disputeStatus === "accepted" || updates.disputeStatus === "rejected")) {
      if (updates.disputeStatus === "accepted") {
        // Accept dispute: reopen the report
        updateData.status = "reopened";
        updateData.disputeStatus = "accepted";
        const existingHistory = (reportData.statusHistory as Array<{ status: string; changedAt: Date; changedBy: string }>) || [];
        updateData.statusHistory = [
          ...existingHistory,
          {
            status: "reopened",
            changedAt: new Date(),
            changedBy: apiKey.createdBy,
          },
        ];
      } else if (updates.disputeStatus === "rejected") {
        // Reject dispute: keep report resolved
        updateData.disputeStatus = "rejected";
      }
    }

    if (isAdmin) {
      if (updates.moderationStatus !== undefined) {
        updateData.moderationStatus = updates.moderationStatus;
        updateData.moderatedAt = new Date();
        updateData.moderatedBy = apiKey.createdBy;
      }
      if (updates.moderationReason !== undefined) {
        updateData.moderationReason = updates.moderationReason;
      }
    }

    await reportRef.update(updateData);

    const updatedSnapshot = await reportRef.get();
    const report = sanitizeReport(updatedSnapshot, true);

    const response = success({ report });
    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("PATCH /api/reports/[id] error:", err);
    return internalError("Failed to update report");
  }
}