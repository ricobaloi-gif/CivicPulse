"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import {
  useAuth,
} from "@/src/lib/AuthContext";

type NotificationItem = {
  id: string;

  userId: string;

  type:
    | "status"
    | "assignment"
    | "comment"
    | "confirmation"
    | "system";

  title: string;
  message: string;

  reportId?: string | null;

  read: boolean;

  createdAt?: Timestamp | null;
};

function getNotificationIcon(
  type: NotificationItem["type"]
) {
  switch (type) {
    case "status":
      return "🔄";

    case "assignment":
      return "🗂️";

    case "comment":
      return "💬";

    case "confirmation":
      return "✅";

    case "system":
      return "🔔";

    default:
      return "🔔";
  }
}

function getNotificationClasses(
  type: NotificationItem["type"]
) {
  switch (type) {
    case "status":
      return "border-blue-900 bg-blue-950/20";

    case "assignment":
      return "border-indigo-900 bg-indigo-950/20";

    case "comment":
      return "border-purple-900 bg-purple-950/20";

    case "confirmation":
      return "border-green-900 bg-green-950/20";

    case "system":
      return "border-gray-800 bg-gray-900";

    default:
      return "border-gray-800 bg-gray-900";
  }
}

function formatDate(
  timestamp?: Timestamp | null
) {
  if (!timestamp) {
    return "Just now";
  }

  const date =
    timestamp.toDate();

  const now =
    new Date();

  const difference =
    now.getTime() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        60000
    );

  const hours =
    Math.floor(
      difference /
        3600000
    );

  const days =
    Math.floor(
      difference /
        86400000
    );

  if (
    minutes < 1
  ) {
    return "Just now";
  }

  if (
    minutes < 60
  ) {
    return `${minutes} minute${
      minutes === 1
        ? ""
        : "s"
    } ago`;
  }

  if (
    hours < 24
  ) {
    return `${hours} hour${
      hours === 1
        ? ""
        : "s"
    } ago`;
  }

  if (
    days < 7
  ) {
    return `${days} day${
      days === 1
        ? ""
        : "s"
    } ago`;
  }

  return date.toLocaleString();
}

export default function NotificationsPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
  } =
    useAuth();

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      NotificationItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    markingAll,
    setMarkingAll,
  ] =
    useState(false);

  async function loadNotifications() {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const notificationsQuery =
        query(
          collection(
            db,
            "notifications"
          ),
          where(
            "userId",
            "==",
            user.uid
          ),
          orderBy(
            "createdAt",
            "desc"
          )
        );

      const snapshot =
        await getDocs(
          notificationsQuery
        );

      const items =
        snapshot.docs.map(
          (notificationDoc) => ({
            id:
              notificationDoc.id,

            ...notificationDoc.data(),
          })
        ) as NotificationItem[];

      setNotifications(
        items
      );
    } catch (err) {
      console.error(
        "Load notifications error:",
        err
      );

      setError(
        "Unable to load your notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    loadNotifications();
  }, [
    user,
    authLoading,
  ]);

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (notification) =>
            !notification.read
        ).length,

      [notifications]
    );

  async function markAsRead(
    notification:
      NotificationItem
  ) {
    if (
      notification.read
    ) {
      return;
    }

    try {
      const notificationRef =
        doc(
          db,
          "notifications",
          notification.id
        );

      await updateDoc(
        notificationRef,
        {
          read: true,
        }
      );

      setNotifications(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    read: true,
                  }
                : item
          )
      );
    } catch (err) {
      console.error(
        "Mark notification error:",
        err
      );
    }
  }

  async function openNotification(
    notification:
      NotificationItem
  ) {
    await markAsRead(
      notification
    );

    if (
      notification.reportId
    ) {
      router.push(
        `/report/${notification.reportId}`
      );
    }
  }

  async function markAllAsRead() {
    if (
      !user ||
      unreadCount === 0
    ) {
      return;
    }

    try {
      setMarkingAll(true);
      setError("");

      const batch =
        writeBatch(db);

      notifications
        .filter(
          (notification) =>
            !notification.read
        )
        .forEach(
          (notification) => {
            const notificationRef =
              doc(
                db,
                "notifications",
                notification.id
              );

            batch.update(
              notificationRef,
              {
                read: true,
              }
            );
          }
        );

      await batch.commit();

      setNotifications(
        (current) =>
          current.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          )
      );
    } catch (err) {
      console.error(
        "Mark all notifications error:",
        err
      );

      setError(
        "Unable to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />

          <p className="mt-4 text-gray-400">
            Loading notifications...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-4xl p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-gray-800 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold sm:text-4xl">
                Notifications
              </h1>

              {unreadCount >
                0 && (
                <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                  {
                    unreadCount
                  }
                </span>
              )}
            </div>

            <p className="mt-2 text-gray-400">
              Updates about your CivicPulse reports and cases.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {unreadCount >
              0 && (
              <button
                type="button"
                onClick={
                  markAllAsRead
                }
                disabled={
                  markingAll
                }
                className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {markingAll
                  ? "Updating..."
                  : "Mark All Read"}
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500"
            >
              Dashboard
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="mt-8">
          {notifications.length ===
          0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center">
              <div className="text-6xl">
                🔔
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                No notifications yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-gray-400">
                Updates about reports, comments and assigned cases will appear here.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/dashboard"
                  )
                }
                className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(
                (
                  notification
                ) => (
                  <button
                    key={
                      notification.id
                    }
                    type="button"
                    onClick={() =>
                      openNotification(
                        notification
                      )
                    }
                    className={`w-full rounded-2xl border p-5 text-left transition hover:border-blue-600 ${getNotificationClasses(
                      notification.type
                    )} ${
                      notification.read
                        ? "opacity-70"
                        : ""
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-2xl">
                        {getNotificationIcon(
                          notification.type
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-bold">
                                {
                                  notification.title
                                }
                              </h2>

                              {!notification.read && (
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                              )}
                            </div>

                            <p className="mt-2 leading-6 text-gray-300">
                              {
                                notification.message
                              }
                            </p>
                          </div>

                          <p className="shrink-0 text-xs text-gray-500">
                            {formatDate(
                              notification.createdAt
                            )}
                          </p>
                        </div>

                        {notification.reportId && (
                          <p className="mt-4 text-sm font-semibold text-blue-400">
                            View report →
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}