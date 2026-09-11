/**
 * Notification helper for CivicPulse.
 *
 * Creates in-app notifications in the `notifications` collection.
 * Supports all notification types: status, assignment, comment,
 * confirmation, escalation, dispute, resolution, invite, sla-warning, system.
 */

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { NotificationType } from "@/src/lib/types";

// Re-export the type for backward compatibility
export type { NotificationType };

interface CreateNotificationInput {
  userId: string;
  createdBy: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string | null;
  organizationId?: string | null;
}

/**
 * Create a notification for a specific user.
 *
 * The notification appears in the user's notification center
 * and increments their unread badge count.
 */
export async function createNotification({
  userId,
  createdBy,
  type,
  title,
  message,
  reportId = null,
  organizationId = null,
}: CreateNotificationInput): Promise<void> {
  // Don't create notification if essential fields are missing
  if (!userId || !createdBy) {
    return;
  }

  // Don't notify yourself
  if (userId === createdBy) {
    return;
  }

  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      createdBy,
      type,
      title,
      message,
      reportId,
      organizationId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Notification failures should not break the main operation
    console.error("Failed to create notification:", err);
  }
}

/**
 * Create notifications for multiple users at once.
 * Useful for broadcasting (e.g., escalation affects multiple people).
 */
export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationInput, "userId">
): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  await Promise.allSettled(
    uniqueIds.map((userId) =>
      createNotification({ ...params, userId })
    )
  );
}