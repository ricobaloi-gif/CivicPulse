import { NextRequest } from "next/server";
import { getAuth, Auth } from "firebase-admin/auth";
import { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/apiAuth";
import { revokeApiKey, updateApiKeyName } from "@/src/lib/apiAuth";
import { createAuditLog } from "@/src/lib/auditLog";
import { success, error, validationError, unauthorized, notFound, internalError } from "@/src/lib/apiResponse";

export const dynamic = "force-dynamic";

let adminAuthInstance: Auth | null = null;
function getAdminAuth(): Auth {
  if (!adminAuthInstance) {
    adminAuthInstance = getAuth();
  }
  return adminAuthInstance;
}

async function verifyAdminAuth(request: NextRequest): Promise<{ uid: string; organizationId: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as Record<string, unknown> | undefined;
    if (!userData) {
      return null;
    }
    const organizationId = userData.organizationId as string;
    const orgRole = userData.organizationRole as string;

    if (!organizationId || (orgRole !== "owner" && orgRole !== "admin")) {
      return null;
    }

    return { uid, organizationId };
  } catch {
    return null;
  }
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

    await createAuditLog({
      organizationId: auth.organizationId,
      action: "org_settings_changed",
      entityType: "apiKey",
      entityId: id,
      performedBy: auth.uid,
      performedByName: "Admin",
      performedByRole: "admin",
      metadata: { action: "api_key_revoked" },
    });

    const response = success({ message: "API key revoked" });
    return response;
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

  const b = body as Record<string, unknown>;
  if (!b.name || typeof b.name !== "string" || b.name.trim().length === 0) {
    return validationError("Name is required");
  }

  if (b.name.trim().length > 100) {
    return validationError("Name must be 100 characters or less");
  }

  try {
    const result = await updateApiKeyName(id, auth.organizationId, b.name.trim());
    if (!result) {
      return notFound("API key not found");
    }

    await createAuditLog({
      organizationId: auth.organizationId,
      action: "org_settings_changed",
      entityType: "apiKey",
      entityId: id,
      performedBy: auth.uid,
      performedByName: "Admin",
      performedByRole: "admin",
      metadata: { action: "api_key_renamed", newName: b.name.trim() },
    });

    const response = success({ message: "API key name updated" });
    return response;
  } catch (err) {
    console.error("Admin PATCH /api-keys/[id] error:", err);
    return internalError("Failed to update API key name");
  }
}