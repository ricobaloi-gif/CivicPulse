import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp, DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

let adminApp: App | null = null;
let adminDbInstance: Firestore | null = null;

export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDbInstance) {
    adminDbInstance = getFirestore(getAdminApp());
  }
  return adminDbInstance;
}

export const adminDb = {
  get collection() {
    return getAdminDb().collection.bind(getAdminDb());
  },
} as Firestore;

export interface AdminUserContext {
  uid: string;
  organizationId: string;
  organizationRole: string;
  role: string;
  name: string;
}

export async function verifyOrganizationAdmin(
  request: NextRequest
): Promise<AdminUserContext | null> {
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
    const userDoc = await getAdminDb().collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data() ?? {};
    const organizationId =
      typeof data.organizationId === "string" ? data.organizationId : "";
    const organizationRole =
      typeof data.organizationRole === "string" ? data.organizationRole : "";
    const role = typeof data.role === "string" ? data.role : "";
    const name = typeof data.name === "string" ? data.name : "Admin";

    const hasAdminSecurityRole = role === "admin";
    const hasAdminOrgRole =
      organizationRole === "owner" || organizationRole === "admin";

    if (!organizationId || !hasAdminSecurityRole || !hasAdminOrgRole) {
      return null;
    }

    return {
      uid: decodedToken.uid,
      organizationId,
      organizationRole,
      role,
      name,
    };
  } catch (err) {
    console.error("Admin ID token verification failed:", err);
    return null;
  }
}

export interface ApiKeyData {
  id: string;
  organizationId: string;
  name: string;
  keyHash: string;
  prefix: string;
  active: boolean;
  permissions: string[];
  createdAt: Date;
  createdBy: string;
  lastUsedAt?: Date;
  revokedAt?: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKeyData;
  error?: string;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
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
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapApiKey(id: string, data: DocumentData): ApiKeyData {
  return {
    id,
    organizationId: String(data.organizationId ?? ""),
    name: String(data.name ?? ""),
    keyHash: String(data.keyHash ?? ""),
    prefix: String(data.prefix ?? ""),
    active: data.active === true,
    permissions: Array.isArray(data.permissions) ? data.permissions.map(String) : [],
    createdAt: toDate(data.createdAt) ?? new Date(0),
    createdBy: String(data.createdBy ?? ""),
    lastUsedAt: toDate(data.lastUsedAt),
    revokedAt: toDate(data.revokedAt),
  };
}

export function generateApiKey(): {
  rawKey: string;
  prefix: string;
  keyHash: string;
} {
  const randomString = randomBytes(32).toString("base64url");
  const rawKey = `cp_live_${randomString}`;
  const prefix = `cp_live_${randomString.slice(0, 8)}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  return { rawKey, prefix, keyHash };
}

export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyValidationResult> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const providedKey = authHeader.slice(7).trim();

  if (!providedKey.startsWith("cp_live_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  const keyHash = createHash("sha256").update(providedKey).digest("hex");

  try {
    const snapshot = await getAdminDb()
      .collection("apiKeys")
      .where("keyHash", "==", keyHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: "Invalid API key" };
    }

    const doc = snapshot.docs[0];
    const apiKey = mapApiKey(doc.id, doc.data());

    if (!apiKey.active) {
      return { valid: false, error: "API key is disabled" };
    }

    if (apiKey.revokedAt) {
      return { valid: false, error: "API key has been revoked" };
    }

    await doc.ref.update({
      lastUsedAt: new Date(),
    });

    return { valid: true, apiKey };
  } catch (err) {
    console.error("API key validation error:", err);
    return { valid: false, error: "Authentication failed" };
  }
}

export async function createApiKey(
  organizationId: string,
  name: string,
  createdBy: string,
  permissions: string[] = [
    "reports:read",
    "reports:write",
    "areas:read",
    "analytics:read",
  ]
): Promise<{ rawKey: string; apiKey: ApiKeyData }> {
  const { rawKey, prefix, keyHash } = generateApiKey();
  const now = new Date();

  const data = {
    organizationId,
    name,
    keyHash,
    prefix,
    active: true,
    permissions,
    createdAt: now,
    createdBy,
  };

  const docRef = await getAdminDb().collection("apiKeys").add(data);

  return {
    rawKey,
    apiKey: {
      id: docRef.id,
      ...data,
    },
  };
}

export async function listApiKeys(
  organizationId: string
): Promise<ApiKeyData[]> {
  const snapshot = await getAdminDb()
    .collection("apiKeys")
    .where("organizationId", "==", organizationId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => mapApiKey(doc.id, doc.data()));
}

export async function revokeApiKey(
  apiKeyId: string,
  organizationId: string
): Promise<boolean> {
  const docRef = getAdminDb().collection("apiKeys").doc(apiKeyId);
  const doc = await docRef.get();

  if (!doc.exists || doc.data()?.organizationId !== organizationId) {
    return false;
  }

  await docRef.update({
    active: false,
    revokedAt: new Date(),
  });

  return true;
}

export async function updateApiKeyName(
  apiKeyId: string,
  organizationId: string,
  name: string
): Promise<boolean> {
  const docRef = getAdminDb().collection("apiKeys").doc(apiKeyId);
  const doc = await docRef.get();

  if (!doc.exists || doc.data()?.organizationId !== organizationId) {
    return false;
  }

  await docRef.update({ name });
  return true;
}
