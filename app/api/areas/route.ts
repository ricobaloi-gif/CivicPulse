import { NextRequest } from "next/server";
import { Query, DocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import { validateApiKey } from "@/src/lib/apiAuth";
import { checkRateLimit, addRateLimitHeaders, createRateLimitedResponse } from "@/src/lib/rateLimit";
import { success, error, validationError, unauthorized, internalError } from "@/src/lib/apiResponse";
import { adminDb } from "@/src/lib/apiAuth";

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

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("Authorization"));

  if (!authResult.valid || !authResult.apiKey) {
    return unauthorized(authResult.error);
  }

  const { apiKey } = authResult;
  const organizationId = apiKey.organizationId;

  const rateLimitInfo = await checkRateLimit(apiKey.id, "/api/areas", "GET");
  if (!rateLimitInfo.allowed) {
    return createRateLimitedResponse(rateLimitInfo);
  }

  const activeOnly = request.nextUrl.searchParams.get("active");

  try {
    const areasRef = adminDb.collection("areas");
    let q: Query = areasRef.where("organizationId", "==", organizationId).orderBy("name", "asc");

    if (activeOnly === "true") {
      q = q.where("active", "==", true);
    } else if (activeOnly === "false") {
      q = q.where("active", "==", false);
    }

    const snapshot = await q.get();
    const areas = snapshot.docs.map((doc: DocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown> | undefined;
      if (!data) return { id: doc.id };
      return {
        id: doc.id,
        name: data.name as string,
        type: data.type as string,
        code: data.code as string | undefined,
        description: data.description as string | undefined,
        municipality: data.municipality as string | undefined,
        province: data.province as string | undefined,
        country: data.country as string | undefined,
        active: data.active as boolean,
        assignedStaff: (data.assignedStaff as string[]) || [],
        createdAt: toISOString(data.createdAt) ?? data.createdAt,
        updatedAt: toISOString(data.updatedAt) ?? data.updatedAt,
      };
    });

    const response = success({
      areas,
      total: areas.length,
    });

    return addRateLimitHeaders(response, rateLimitInfo);
  } catch (err) {
    console.error("GET /api/areas error:", err);
    return internalError("Failed to fetch areas");
  }
}