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
import { formatRelativeTime } from "@/src/lib/constants";
import { Mail, MessageSquare, CheckCircle, AlertTriangle, Bell, UserPlus, Clock, FileText, MapPin } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  reportId?: string | null;
  read: boolean;
  createdAt?: { toDate(): Date } | null;
}

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  status: FileText,
  assignment: UserPlus,
  comment: MessageSquare,
  confirmation: CheckCircle,
  escalation: AlertTriangle,
  dispute: AlertTriangle,
  resolution: CheckCircle,
  invite: Mail,
  "sla-warning": Clock,
  system: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (!notification.read) {
        try {
          await updateDoc(doc(db, "notifications", notification.id), {
            read: true,
          });
        } catch (err) {
          console.error("Mark read error:", err);
        }
      }

      if (notification.type === "invite") {
        router.push("/organization/invites");
        return;
      }

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
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="btn-secondary btn-sm"
          >
            Mark All Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          message="You'll be notified when there are updates on your reports."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                  notification.read
                    ? "border-border bg-surface/50 opacity-70"
                    : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-semibold ${
                        notification.read ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  {notification.createdAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
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