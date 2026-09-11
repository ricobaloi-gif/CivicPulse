/**
 * Audit log helper for CivicPulse.
 *
 * All security-sensitive operations should create an audit log entry.
 * Audit logs are organization-scoped and tamper-resistant (residents cannot write).
 */

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { AuditAction } from "@/src/lib/types";

interface CreateAuditLogInput {
  organizationId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an audit log entry in Firestore.
 *
 * Security note: In production, critical audit logs should be created
 * via server-side logic (Next.js route handlers) to prevent client
 * tampering. This client-side helper is used for operations where
 * the Firestore security rules validate the caller's identity.
 */
export async function createAuditLog({
  organizationId,
  action,
  entityType,
  entityId,
  performedBy,
  performedByName,
  performedByRole,
  metadata = {},
}: CreateAuditLogInput): Promise<void> {
  if (!organizationId || !performedBy) {
    console.warn("Audit log skipped: missing organizationId or performedBy");
    return;
  }

  try {
    await addDoc(collection(db, "auditLogs"), {
      organizationId,
      action,
      entityType,
      entityId,
      performedBy,
      performedByName,
      performedByRole,
      metadata,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Audit log failures should not break the main operation
    console.error("Failed to create audit log:", err);
  }
}
