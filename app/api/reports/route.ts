import { NextRequest } from "next/server";
import { FieldValue, Query, DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import { validateApiKey } from "@/src/lib/apiAuth";
import { checkRateLimit, addRateLimitHeaders, createRateLimitedResponse } from "@/src/lib/rateLimit";
import { success, error, validationError, unauthorized, notFound, internalError } from "@/src/lib/apiResponse";
import { CATEGORIES, SEVERITIES, STATUSES } from "@/src/lib/constants";
import { adminDb } from "@/src/lib/apiAuth";
import type { ReportCategory, ReportSeverity, ReportStatus } from "@/src/lib/types";

export const dynamic = "force-dynamic";

function toISOString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Record<string, unknown>).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const VALID_CATEGORIES = new Set(CATEGORIES);
const VALID_SEVERITIES = new Set(SEVERITIES);
const VALID_STATUSES = new Set(STATUSES);

interface ReportFilters {
  category?: string;
  severity?: string;
  status?: string;
  areaId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

function validateFilters(params: URLSearchParams): { filters: ReportFilters; errors: string[] } {
  const errors: string[] = [];
  const filters: ReportFilters = {};

  const category = params.get("category");
  if (category && !VALID_CATEGORIES.has(category as ReportCategory)) {
    errors.push(`Invalid category: ${category}`);
  } else if (category) {
    filters.category = category;
  }

  const severity = params.get("severity");
  if (severity && !VALID_SEVERITIES.has(severity as ReportSeverity)) {
    errors.push(`Invalid severity: ${severity}`);
  } else if (severity) {
    filters.severity = severity;
  }

  const status = params.get("status");
  if (status && !VALID_STATUSES.has(status as ReportStatus)) {
    errors.push(`Invalid status: ${status}`);
  } else if (status) {
    filters.status = status;
  }

  const areaId = params.get("areaId");
  if (areaId) filters.areaId = areaId;

  const assignedTo = params.get("assignedTo");
  if (assignedTo) filters.assignedTo = assignedTo;

  const dateFrom = params.get("dateFrom");
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (isNaN(d.getTime())) {
      errors.push("Invalid dateFrom format. Use ISO 8601.");
    } else {
      filters.dateFrom = dateFrom;
    }
  }

  const dateTo = params.get("dateTo");
  if (dateTo) {
    const d = new Date(dateTo);
    if (isNaN(d.getTime())) {
      errors.push("Invalid dateTo format. Use ISO 8601.");
    } else {
      filters.dateTo = dateTo;
    }
  }

  const limitParam = params.get("limit");
  if (limitParam) {
    const lim = parseInt(limitParam, 10);
    if (isNaN(lim) || lim < 1 || lim > MAX_LIMIT) {
      errors.push(`Limit must be between 1 and ${MAX_LIMIT}`);
    } else {
      filters.limit = lim;
    }
  } else {
    filters.limit = DEFAULT_LIMIT;
  }

  const cursor = params.get("cursor");
  if (cursor) filters.cursor = cursor;

  return { filters, errors };
}

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
    createdAt: toISOString(data.createdAt) ?? data.createdAt,
    updatedAt: toISOString(data.updatedAt) ?? data.updatedAt,
    submittedAt: toISOString(data.submittedAt) ?? data.submittedAt,
    acknowledgedAt: toISOString(data.acknowledgedAt) ?? data.acknowledgedAt,
  };

  if (includePrivate) {
    report.createdBy = data.createdBy;
    report.createdByName = data.createdByName;
    report.organizationId = data.organizationId;
    report.organizationName = data.organizationName;
    report.confirmedBy = data.confirmedBy;
    report.assignedAt = toISOString(data.assignedAt) ?? data.assignedAt;
    report.priority = data.priority;
    report.escalated = data.escalated;
    report.escalatedAt = toISOString(data.escalatedAt) ?? data.escalatedAt;
    report.escalatedBy = data.escalatedBy;
    report.escalationReason = data.escalationReason;
    report.resolutionNote = data.resolutionNote;
    report.resolvedAt = toISOString(data.resolvedAt) ?? data.resolvedAt;
    report.resolvedBy = data.resolvedBy;
    report.resolutionImageUrls = data.resolutionImageUrls;
    report.moderationStatus = data.moderationStatus;
    report.disputeStatus = data.disputeStatus;
    report.statusHistory = data.statusHistory;
  }

  return report;
}

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, "/api/reports", "GET");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  const { filters, errors } = validateFilters(request.nextUrl.searchParams);
  if (errors.length > 0) {
    return validationError("Invalid query parameters", { errors });
  }

  try {
    const reportsRef = adminDb.collection("reports");
    let q: Query = reportsRef.where("organizationId", "==", organizationId).orderBy("createdAt", "desc");

    if (filters.category) q = q.where("category", "==", filters.category);
    if (filters.severity) q = q.where("severity", "==", filters.severity);
    if (filters.status) q = q.where("status", "==", filters.status);
    if (filters.areaId) q = q.where("areaId", "==", filters.areaId);
    if (filters.assignedTo) q = q.where("assignedTo", "==", filters.assignedTo);

    if (filters.dateFrom) {
      q = q.where("createdAt", ">=", new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      q = q.where("createdAt", "<", endDate);
    }

    if (filters.cursor) {
      const cursorDoc = await adminDb.collection("reports").doc(filters.cursor).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc).limit(filters.limit!);
      } else {
        q = q.limit(filters.limit!);
      }
    } else {
      q = q.limit(filters.limit!);
    }

    const snapshot = await q.get();
    const reports = snapshot.docs.map((doc: QueryDocumentSnapshot) => sanitizeReport(doc, false));

    const response = success({
      reports,
      pagination: {
        limit: filters.limit,
        count: reports.length,
        hasMore: reports.length === filters.limit,
        nextCursor: reports.length === filters.limit ? snapshot.docs[snapshot.docs.length - 1].id : null,
      },
    });

    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return internalError("Failed to fetch reports");
  }
}

interface CreateReportInput {
  title: string;
  description: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  address?: string;
  areaId?: string;
  areaName?: string;
  ward?: string;
  municipality?: string;
  imageUrl?: string;
}

function validateCreateReport(body: unknown): { valid: boolean; data?: CreateReportInput; errors?: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  const title = b.title;
  if (!title || typeof title !== "string" || title.trim().length < 5 || title.trim().length > 200) {
    errors.push("Title is required (5-200 characters)");
  }

  const description = b.description;
  if (!description || typeof description !== "string" || description.trim().length < 10 || description.trim().length > 5000) {
    errors.push("Description is required (10-5000 characters)");
  }

  const category = b.category;
  if (!category || typeof category !== "string" || !VALID_CATEGORIES.has(category as ReportCategory)) {
    errors.push(`Category is required and must be one of: ${CATEGORIES.join(", ")}`);
  }

  const severity = b.severity;
  if (!severity || typeof severity !== "string" || !VALID_SEVERITIES.has(severity as ReportSeverity)) {
    errors.push(`Severity is required and must be one of: ${SEVERITIES.join(", ")}`);
  }

  const latitude = b.latitude;
  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
    errors.push("Latitude is required and must be between -90 and 90");
  }

  const longitude = b.longitude;
  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
    errors.push("Longitude is required and must be between -180 and 180");
  }

  const address = b.address;
  if (address !== undefined && (typeof address !== "string" || address.length > 500)) {
    errors.push("Address must be a string (max 500 characters)");
  }

  const areaId = b.areaId;
  if (areaId !== undefined && (typeof areaId !== "string" || areaId.length > 100)) {
    errors.push("Area ID must be a string (max 100 characters)");
  }

  const imageUrl = b.imageUrl;
  if (imageUrl !== undefined && (typeof imageUrl !== "string" || !isValidUrl(imageUrl))) {
    errors.push("Image URL must be a valid URL");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const titleStr = title as string;
  const descStr = description as string;
  const catStr = category as string;
  const sevStr = severity as string;
  const latNum = latitude as number;
  const lngNum = longitude as number;
  const addrStr = address as string | undefined;
  const areaIdStr = areaId as string | undefined;

  return {
    valid: true,
    data: {
      title: titleStr.trim(),
      description: descStr.trim(),
      category: catStr,
      severity: sevStr,
      latitude: latNum,
      longitude: lngNum,
      address: addrStr?.trim(),
      areaId: areaIdStr,
      areaName: b.areaName as string | undefined,
      ward: b.ward as string | undefined,
      municipality: b.municipality as string | undefined,
      imageUrl: imageUrl as string | undefined,
    },
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, "/api/reports", "POST");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  const validation = validateCreateReport(body);
  if (!validation.valid) {
    return validationError("Validation failed", { errors: validation.errors });
  }

  const input = validation.data!;

  try {
    const orgDoc = await adminDb.collection("organizations").doc(organizationId).get();
    if (!orgDoc.exists) {
      return internalError("Organization not found");
    }
    const orgData = orgDoc.data() as Record<string, unknown> | undefined;
    if (!orgData) {
      return internalError("Organization not found");
    }

    const now = new Date();

    // Firestore rejects `undefined` values by default. Build the document
    // explicitly and only include optional fields when they are present.
    const reportData: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      latitude: input.latitude,
      longitude: input.longitude,
      organizationId,
      organizationName: orgData.name as string,
      status: "submitted",
      confirmationCount: 0,
      confirmedBy: [],
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      geohash: "",
    };

    if (input.address) reportData.address = input.address;
    if (input.areaId) reportData.areaId = input.areaId;
    if (input.areaName) reportData.areaName = input.areaName;
    if (input.ward) reportData.ward = input.ward;
    if (input.municipality) reportData.municipality = input.municipality;
    if (input.imageUrl) reportData.imageUrl = input.imageUrl;

    const docRef = await adminDb.collection("reports").add(reportData);

    await adminDb.collection("organizations").doc(organizationId).update({
      reportsThisMonth: (orgData.reportsThisMonth as number || 0) + 1,
      updatedAt: now,
    });

    const createdDoc = await docRef.get();
    const report = sanitizeReport(createdDoc, true);

    const response = success({ report }, 201);
    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("POST /api/reports error:", err);
    return internalError("Failed to create report");
  }
}