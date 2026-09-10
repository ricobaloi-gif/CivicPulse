import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

export type NotificationType =
  | "status"
  | "assignment"
  | "comment"
  | "confirmation"
  | "system";

type CreateNotificationInput = {
  userId: string;
  createdBy: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string | null;
};

export async function createNotification({
  userId,
  createdBy,
  type,
  title,
  message,
  reportId = null,
}: CreateNotificationInput) {
  if (
    !userId ||
    !createdBy
  ) {
    return;
  }

  await addDoc(
    collection(
      db,
      "notifications"
    ),
    {
      userId,

      createdBy,

      type,

      title,

      message,

      reportId,

      read: false,

      createdAt:
        serverTimestamp(),
    }
  );
}