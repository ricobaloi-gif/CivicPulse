import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  getAdminApp,
  revokeApiKey,
  updateApiKeyName,
} from "@/src/lib/apiAuth";
import {
  success,
  validationError,
  unauthorized,
  notFound,
  internalError,
} from "@/src/lib/apiResponse";

export const dynamic = "force-dynamic";

type AdminAuthContext = {
  uid: string;
  organizationId: string;
  name: string;
  role: string;
};

async function verifyAdminAuth(
  request: NextRequest
): Promise<AdminAuthContext | null> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decodedToken = await getAuth(getAdminApp()).verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as Record<string, unknown> | undefined;
    if (!userData) {
      return null;
    }

    const organizationId =
      typeof userData.organizationId === "string"
        ? userData.organizationId
        : "";

    const organizationRole =
      typeof userData.organizationRole === "string"
        ? userData.organizationRole
        : "";

    const role =
      typeof userData.role === "string"
        ? userData.role
        : "";

    const name =
      typeof userData.name === "string" && userData.name.trim()
        ? userData.name.trim()
        : "Admin";

    const isAdminRole = role === "admin";
    const isOrganizationAdmin =
      organizationRole === "owner" || organizationRole === "admin";

    if (!organizationId || !isAdminRole || !isOrganizationAdmin) {
      return null;
    }

    return {
      uid: decodedToken.uid,
      organizationId,
      name,
      role,
    };
  } catch (err) {
    console.error("Admin API key auth verification failed:", err);
    return null;
  }
}

async function writeApiKeyAuditLog(params: {
  organizationId: string;
  action: "api_key_revoked" | "api_key_renamed";
  apiKeyId: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  metadata?: Record<string, unknown>;
}) {
  await adminDb.collection("auditLogs").add({
    organizationId: params.organizationId,
    action: "org_settings_changed",
    entityType: "apiKey",
    entityId: params.apiKeyId,
    performedBy: params.performedBy,
    performedByName: params.performedByName,
    performedByRole: params.performedByRole,
    metadata: {
      action: params.action,
      ...(params.metadata ?? {}),
    },
    createdAt: new Date(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAdminAuth(request);
  if (!auth) {
    return unauthorized("Admin authentication required");
  }

  try {
    const result = await revokeApiKey(id, auth.organizationId);

    if (!result) {
      return notFound("API key not found");
    }

    await writeApiKeyAuditLog({
      organizationId: auth.organizationId,
      action: "api_key_revoked",
      apiKeyId: id,
      performedBy: auth.uid,
      performedByName: auth.name,
      performedByRole: auth.role,
    });

    return success({ message: "API key revoked" });
  } catch (err) {
    console.error("Admin DELETE /api-keys/[id] error:", err);
    return internalError("Failed to revoke API key");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAdminAuth(request);
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

  const requestBody = body as Record<string, unknown>;
  const rawName = requestBody.name;

  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return validationError("Name is required");
  }

  const name = rawName.trim();

  if (name.length > 100) {
    return validationError("Name must be 100 characters or less");
  }

  try {
    const result = await updateApiKeyName(
      id,
      auth.organizationId,
      name
    );

    if (!result) {
      return notFound("API key not found");
    }

    await writeApiKeyAuditLog({
      organizationId: auth.organizationId,
      action: "api_key_renamed",
      apiKeyId: id,
      performedBy: auth.uid,
      performedByName: auth.name,
      performedByRole: auth.role,
      metadata: {
        newName: name,
      },
    });

    return success({ message: "API key name updated" });
  } catch (err) {
    console.error("Admin PATCH /api-keys/[id] error:", err);
    return internalError("Failed to update API key name");
  }
}
