import { NextRequest } from "next/server";
import { Query, DocumentSnapshot } from "firebase-admin/firestore";
import { validateApiKey } from "@/src/lib/apiAuth";
import { checkRateLimit, addRateLimitHeaders, createRateLimitedResponse } from "@/src/lib/rateLimit";
import { success, error, validationError, unauthorized, internalError } from "@/src/lib/apiResponse";
import { adminDb } from "@/src/lib/apiAuth";
import { RESOLVED_STATUSES, STATUSES, SEVERITIES, CATEGORIES } from "@/src/lib/constants";

export const dynamic = "force-dynamic";

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
    const q: Query = reportsRef.where("organizationId", "==", organizationId);
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

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    reports.forEach((r: Record<string, unknown>) => {
      if ((r.status === "resolved" || r.status === "verified") && r.createdAt && r.resolvedAt) {
        const created = (r.createdAt as any).toDate ? (r.createdAt as any).toDate() : new Date(r.createdAt as string);
        const resolved = (r.resolvedAt as any).toDate ? (r.resolvedAt as any).toDate() : new Date(r.resolvedAt as string);
        totalResolutionTime += resolved.getTime() - created.getTime();
        resolvedCount++;
      }
    });
    const averageResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

    const response = success({
      totalReports,
      openReports,
      resolvedReports,
      criticalReports,
      statusBreakdown,
      severityBreakdown,
      categoryBreakdown,
      averageResolutionTimeMs: averageResolutionTime,
      averageResolutionTimeHours: averageResolutionTime > 0 ? Math.round(averageResolutionTime / (1000 * 60 * 60) * 100) / 100 : 0,
      escalatedCases,
      assignedCases,
    });

    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("GET /api/analytics error:", err);
    return internalError("Failed to fetch analytics");
  }
}