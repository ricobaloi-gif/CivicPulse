import { NextRequest } from "next/server";
import {
  adminDb,
  listApiKeys,
  createApiKey,
  verifyOrganizationAdmin,
  type ApiKeyData,
} from "@/src/lib/apiAuth";
import {
  success,
  validationError,
  unauthorized,
  internalError,
} from "@/src/lib/apiResponse";

export const dynamic = "force-dynamic";

function publicApiKey(apiKey: ApiKeyData) {
  return {
    id: apiKey.id,
    organizationId: apiKey.organizationId,
    name: apiKey.name,
    prefix: apiKey.prefix,
    active: apiKey.active,
    permissions: apiKey.permissions,
    createdAt: apiKey.createdAt,
    createdBy: apiKey.createdBy,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyOrganizationAdmin(request);

  if (!auth) {
    return unauthorized("Admin authentication required");
  }

  try {
    const apiKeys = await listApiKeys(auth.organizationId);
    return success({
      apiKeys: apiKeys.map(publicApiKey),
    });
  } catch (err) {
    console.error("Admin GET /api-keys error:", err);
    return internalError("Failed to fetch API keys");
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyOrganizationAdmin(request);

  if (!auth) {
    return unauthorized("Admin authentication required");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    return validationError("Request body must be a JSON object");
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.name !== "string" ||
    input.name.trim().length === 0
  ) {
    return validationError("Name is required");
  }

  if (input.name.trim().length > 100) {
    return validationError("Name must be 100 characters or less");
  }

  try {
    const { rawKey, apiKey } = await createApiKey(
      auth.organizationId,
      input.name.trim(),
      auth.uid,
      [
        "reports:read",
        "reports:write",
        "areas:read",
        "analytics:read",
      ]
    );

    await adminDb.collection("auditLogs").add({
      organizationId: auth.organizationId,
      action: "org_settings_changed",
      entityType: "apiKey",
      entityId: apiKey.id,
      performedBy: auth.uid,
      performedByName: auth.name,
      performedByRole: auth.role,
      timestamp: new Date(),
      metadata: {
        action: "api_key_created",
        name: apiKey.name,
        prefix: apiKey.prefix,
      },
    });

    return success(
      {
        rawKey,
        prefix: apiKey.prefix,
        apiKey: publicApiKey(apiKey),
      },
      201
    );
  } catch (err) {
    console.error("Admin POST /api-keys error:", err);
    return internalError("Failed to create API key");
  }
}
