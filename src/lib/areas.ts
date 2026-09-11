/**
 * Ward and Service Area management service for CivicPulse.
 * Handles creating, updating, disabling, and assigning staff to areas.
 * All operations are tenant-scoped to the organisation.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { createAuditLog } from "@/src/lib/auditLog";
import type { Area, AreaType } from "@/src/lib/types";

export interface CreateAreaInput {
  organizationId: string;
  name: string;
  type: AreaType;
  code?: string;
  description?: string;
  municipality?: string;
  province?: string;
  country?: string;
  assignedStaff?: string[];
  createdBy: string;
  createdByName: string;
  createdByRole: string;
}

export interface UpdateAreaInput {
  name?: string;
  type?: AreaType;
  code?: string;
  description?: string;
  municipality?: string;
  province?: string;
  country?: string;
  assignedStaff?: string[];
}

/**
 * Creates a new ward or service area within an organisation.
 */
export async function createArea({
  organizationId,
  name,
  type,
  code,
  description,
  municipality,
  province,
  country = "South Africa",
  assignedStaff = [],
  createdBy,
  createdByName,
  createdByRole,
}: CreateAreaInput): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Area name is required.");
  }

  // Check for duplicate area name in this organization
  const duplicateQuery = query(
    collection(db, "areas"),
    where("organizationId", "==", organizationId),
    where("name", "==", trimmedName)
  );
  const duplicateSnapshot = await getDocs(duplicateQuery);
  if (!duplicateSnapshot.empty) {
    throw new Error(`An area named "${trimmedName}" already exists in your organisation.`);
  }

  const areaData = {
    organizationId,
    name: trimmedName,
    type,
    code: code?.trim() || null,
    description: description?.trim() || null,
    municipality: municipality?.trim() || null,
    province: province?.trim() || null,
    country: country?.trim() || "South Africa",
    active: true,
    assignedStaff: assignedStaff || [],
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const areaRef = await addDoc(collection(db, "areas"), areaData);

  await createAuditLog({
    organizationId,
    action: "area_created",
    entityType: "area",
    entityId: areaRef.id,
    performedBy: createdBy,
    performedByName: createdByName,
    performedByRole: createdByRole,
    metadata: {
      name: trimmedName,
      type,
      code: code?.trim() || null,
      municipality: municipality?.trim() || null,
    },
  });

  return areaRef.id;
}

/**
 * Updates an existing service area within an organisation.
 */
export async function updateArea(
  areaId: string,
  organizationId: string,
  updates: UpdateAreaInput,
  updatedBy: string,
  updatedByName: string,
  updatedByRole: string
): Promise<void> {
  const areaRef = doc(db, "areas", areaId);
  const areaSnap = await getDoc(areaRef);

  if (!areaSnap.exists()) {
    throw new Error("Area not found.");
  }

  const existingArea = areaSnap.data() as Area;
  if (existingArea.organizationId !== organizationId) {
    throw new Error("Permission denied: Area belongs to another organisation.");
  }

  const cleanedUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.name !== undefined) cleanedUpdates.name = updates.name.trim();
  if (updates.type !== undefined) cleanedUpdates.type = updates.type;
  if (updates.code !== undefined) cleanedUpdates.code = updates.code?.trim() || null;
  if (updates.description !== undefined) cleanedUpdates.description = updates.description?.trim() || null;
  if (updates.municipality !== undefined) cleanedUpdates.municipality = updates.municipality?.trim() || null;
  if (updates.province !== undefined) cleanedUpdates.province = updates.province?.trim() || null;
  if (updates.country !== undefined) cleanedUpdates.country = updates.country?.trim() || null;
  if (updates.assignedStaff !== undefined) cleanedUpdates.assignedStaff = updates.assignedStaff;

  await updateDoc(areaRef, cleanedUpdates);

  await createAuditLog({
    organizationId,
    action: "area_updated",
    entityType: "area",
    entityId: areaId,
    performedBy: updatedBy,
    performedByName: updatedByName,
    performedByRole: updatedByRole,
    metadata: cleanedUpdates,
  });
}

/**
 * Enables or disables a service area (soft toggle).
 */
export async function toggleAreaStatus(
  areaId: string,
  organizationId: string,
  active: boolean,
  updatedBy: string,
  updatedByName: string,
  updatedByRole: string
): Promise<void> {
  const areaRef = doc(db, "areas", areaId);
  const areaSnap = await getDoc(areaRef);

  if (!areaSnap.exists()) {
    throw new Error("Area not found.");
  }

  const existingArea = areaSnap.data() as Area;
  if (existingArea.organizationId !== organizationId) {
    throw new Error("Permission denied: Area belongs to another organisation.");
  }

  await updateDoc(areaRef, {
    active,
    updatedAt: serverTimestamp(),
  });

  await createAuditLog({
    organizationId,
    action: "area_updated",
    entityType: "area",
    entityId: areaId,
    performedBy: updatedBy,
    performedByName: updatedByName,
    performedByRole: updatedByRole,
    metadata: {
      action: active ? "area_enabled" : "area_disabled",
      active,
      name: existingArea.name,
    },
  });
}
