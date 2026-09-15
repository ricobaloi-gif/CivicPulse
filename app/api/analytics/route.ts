import { NextRequest } from "next/server";
import { Query, DocumentSnapshot, Timestamp, FieldValue } from "firebase-admin/firestore";
import { validateApiKey } from "@/src/lib/apiAuth";
import { checkRateLimit, addRateLimitHeaders, createRateLimitedResponse } from "@/src/lib/rateLimit";
import { success, error, validationError, unauthorized, internalError } from "@/src/lib/apiResponse";
import { adminDb } from "@/src/lib/apiAuth";
import { RESOLVED_STATUSES, STATUSES, SEVERITIES, CATEGORIES } from "@/src/lib/constants";

export const dynamic = "force-dynamic";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Record<string, unknown>).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, "/api/analytics", "GET");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  try {
    const reportsRef = adminDb.collection("reports");
    let q: Query = reportsRef.where("organizationId", "==", organizationId);

    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");

    if (dateFrom) {
      q = q.where("createdAt", ">=", new Date(dateFrom));
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      q = q.where("createdAt", "<", endDate);
    }

    const snapshot = await q.get();

    const reports = snapshot.docs.map((doc: DocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown> | undefined;
      return { id: doc.id, ...(data || {}) };
    });

    const totalReports = reports.length;
    const openReports = reports.filter((r: Record<string, unknown>) => !RESOLVED_STATUSES.has(r.status as string)).length;
    const resolvedReports = reports.filter((r: Record<string, unknown>) => r.status === "resolved" || r.status === "verified").length;
    const criticalReports = reports.filter((r: Record<string, unknown>) => r.severity === "critical" && !RESOLVED_STATUSES.has(r.status as string)).length;
    const escalatedCases = reports.filter((r: Record<string, unknown>) => (r.escalationLevel as number || 0) > 0).length;
    const assignedCases = reports.filter((r: Record<string, unknown>) => r.assignedTo).length;

    const statusBreakdown: Record<string, number> = {};
    STATUSES.forEach((s) => (statusBreakdown[s] = 0));
    reports.forEach((r: Record<string, unknown>) => {
      if (r.status && statusBreakdown[r.status as string] !== undefined) {
        statusBreakdown[r.status as string]++;
      }
    });

    const severityBreakdown: Record<string, number> = {};
    SEVERITIES.forEach((s) => (severityBreakdown[s] = 0));
    reports.forEach((r: Record<string, unknown>) => {
      if (r.severity && severityBreakdown[r.severity as string] !== undefined) {
        severityBreakdown[r.severity as string]++;
      }
    });

    const categoryBreakdown: Record<string, number> = {};
    CATEGORIES.forEach((c) => (categoryBreakdown[c] = 0));
    reports.forEach((r: Record<string, unknown>) => {
      if (r.category && categoryBreakdown[r.category as string] !== undefined) {
        categoryBreakdown[r.category as string]++;
      }
    });

    const areaBreakdown: Record<string, number> = {};
    reports.forEach((r: Record<string, unknown>) => {
      const area = (r.areaName as string) || (r.ward as string) || "Unassigned";
      if (area) {
        areaBreakdown[area] = (areaBreakdown[area] || 0) + 1;
      }
    });

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let totalAcknowledgementTime = 0;
    let acknowledgedCount = 0;

    reports.forEach((r: Record<string, unknown>) => {
      if ((r.status === "resolved" || r.status === "verified") && r.createdAt && r.resolvedAt) {
        const created = toDate(r.createdAt);
        const resolved = toDate(r.resolvedAt);
        if (created && resolved) {
          totalResolutionTime += resolved.getTime() - created.getTime();
          resolvedCount++;
        }
      }
      if (r.acknowledgedAt && r.submittedAt) {
        const submitted = toDate(r.submittedAt);
        const acknowledged = toDate(r.acknowledgedAt);
        if (submitted && acknowledged) {
          totalAcknowledgementTime += acknowledged.getTime() - submitted.getTime();
          acknowledgedCount++;
        }
      }
    });

    const averageResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
    const averageAcknowledgementTime = acknowledgedCount > 0 ? totalAcknowledgementTime / acknowledgedCount : 0;

    const orgDoc = await adminDb.collection("organizations").doc(organizationId).get();
    const orgData = orgDoc.data() as Record<string, unknown> | undefined;
    const ackTargetHours = (orgData?.acknowledgementTargetHours as number) || 24;
    const resolutionTargetHours = (orgData?.resolutionTargetHours as number) || 168;

    let slaBreachCount = 0;
    let overdueCount = 0;
    const now = new Date();

    reports.forEach((r: Record<string, unknown>) => {
      const status = r.status as string;
      const created = toDate(r.createdAt);
      const submitted = toDate(r.submittedAt);
      const acknowledged = toDate(r.acknowledgedAt);
      const resolved = toDate(r.resolvedAt);
      const workStarted = toDate(r.workStartedAt);

      if (!RESOLVED_STATUSES.has(status) && created) {
        const hoursSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

        if (status === "submitted" && hoursSinceCreated > ackTargetHours) {
          overdueCount++;
        }
        if (acknowledged && !resolved && hoursSinceCreated > resolutionTargetHours) {
          overdueCount++;
        }
        if (!acknowledged && hoursSinceCreated > ackTargetHours) {
          slaBreachCount++;
        }
        if (acknowledged && !resolved && (now.getTime() - acknowledged.getTime()) / (1000 * 60 * 60) > resolutionTargetHours) {
          slaBreachCount++;
        }
      }
    });

    const staffWorkloadMap = new Map<string, { name: string; assigned: number; inProgress: number; resolved: number }>();
    reports.forEach((r: Record<string, unknown>) => {
      const assignedTo = r.assignedTo as string | undefined;
      const assignedToName = (r.assignedToName as string) || "Unknown Staff";
      const status = r.status as string;

      if (assignedTo) {
        if (!staffWorkloadMap.has(assignedTo)) {
          staffWorkloadMap.set(assignedTo, { name: assignedToName, assigned: 0, inProgress: 0, resolved: 0 });
        }
        const workload = staffWorkloadMap.get(assignedTo)!;
        if (status === "assigned") workload.assigned++;
        else if (status === "in-progress") workload.inProgress++;
        else if (status === "resolved" || status === "verified") workload.resolved++;
      }
    });

    const staffWorkload = Array.from(staffWorkloadMap.values())
      .sort((a, b) => (b.assigned + b.inProgress + b.resolved) - (a.assigned + a.inProgress + a.resolved));

    const monthlyTrendMap = new Map<string, { created: number; resolved: number }>();
    const monthsToShow = 12;
    const nowMonth = new Date();
    nowMonth.setDate(1);

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(nowMonth);
      d.setMonth(d.getMonth() - i);
      monthlyTrendMap.set(formatMonthKey(d), { created: 0, resolved: 0 });
    }

    reports.forEach((r: Record<string, unknown>) => {
      const created = toDate(r.createdAt);
      const resolved = toDate(r.resolvedAt);
      const status = r.status as string;

      if (created) {
        const key = formatMonthKey(created);
        if (monthlyTrendMap.has(key)) {
          monthlyTrendMap.get(key)!.created++;
        }
      }
      if (resolved && (status === "resolved" || status === "verified")) {
        const key = formatMonthKey(resolved);
        if (monthlyTrendMap.has(key)) {
          monthlyTrendMap.get(key)!.resolved++;
        }
      }
    });

    const monthlyTrend = Array.from(monthlyTrendMap.entries()).map(([month, data]) => ({
      month,
      created: data.created,
      resolved: data.resolved,
    }));

    const response = success({
      totalReports,
      openReports,
      resolvedReports,
      criticalReports,
      escalatedReports: escalatedCases,
      statusBreakdown,
      severityBreakdown,
      categoryBreakdown,
      areaBreakdown,
      averageAcknowledgementTimeHours: averageAcknowledgementTime > 0 ? Math.round(averageAcknowledgementTime / (1000 * 60 * 60) * 100) / 100 : 0,
      averageResolutionTimeHours: averageResolutionTime > 0 ? Math.round(averageResolutionTime / (1000 * 60 * 60) * 100) / 100 : 0,
      staffWorkload,
      slaBreachCount,
      overdueCount,
      monthlyTrend,
    });

    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("GET /api/analytics error:", err);
    return internalError("Failed to fetch analytics");
  }
}