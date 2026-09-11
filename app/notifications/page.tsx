"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { EmptyState } from "@/src/components/EmptyState";
import { NOTIFICATION_ICONS, formatRelativeTime } from "@/src/lib/constants";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  reportId?: string | null;
  read: boolean;
  createdAt?: { toDate(): Date } | null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime listener for notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as NotificationItem[];
        setNotifications(items);
        setLoading(false);
      },
      (err) => {
        console.error("Notifications listener error:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleClick = useCallback(
    async (notification: NotificationItem) => {
      // Mark as read
      if (!notification.read) {
        try {
          await updateDoc(doc(db, "notifications", notification.id), {
            read: true,
          });
        } catch (err) {
          console.error("Mark read error:", err);
        }
      }

      // Navigate to invite if invite notification
      if (notification.type === "invite") {
        router.push("/organization/invites");
        return;
      }

      // Navigate to report if linked
      if (notification.reportId) {
        router.push(`/report/${notification.reportId}`);
      }
    },
    [router]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  }, [user, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Layout title="Notifications">
      {/* Header actions */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Mark All Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notifications yet"
          message="You'll be notified when there are updates on your reports."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const icon =
              NOTIFICATION_ICONS[notification.type] ?? "🔔";

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                  notification.read
                    ? "border-gray-800 bg-gray-900/50 opacity-70"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <span className="text-2xl">{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-semibold ${
                        notification.read ? "text-gray-400" : "text-white"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    {notification.message}
                  </p>
                  {notification.createdAt && (
                    <p className="mt-2 text-xs text-gray-500">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}