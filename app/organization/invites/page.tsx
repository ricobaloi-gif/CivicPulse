"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { EmptyState } from "@/src/components/EmptyState";
import { formatRelativeTime } from "@/src/lib/constants";
import {
  acceptOrganizationInvite,
  declineOrganizationInvite,
} from "@/src/lib/invitations";
import type { OrganizationInvite } from "@/src/lib/types";

export default function OrganizationInvitesPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadPendingInvites = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const normalizedEmail = currentUser.email.trim().toLowerCase();
      const q = query(
        collection(db, "organizationInvites"),
        where("email", "==", normalizedEmail),
        where("status", "==", "pending")
      );

      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as OrganizationInvite[];

      setInvites(items);
    } catch (err) {
      console.error("Load invites error:", err);
      setError("Unable to load invitations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const currentUser = userRef.current;
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadPendingInvites();
  }, [user?.email, loadPendingInvites]);

  async function handleAccept(invite: OrganizationInvite) {
    if (!user || !invite.id || !user.email) return;

    try {
      setActingInviteId(invite.id);
      setError("");
      setSuccess("");

      const result = await acceptOrganizationInvite(
        invite.id,
        {
          uid: user.uid,
          email: user.email,
          name: profile?.name,
        },
        profile
      );

      setSuccess(`Welcome to ${result.organizationName}!`);
      await refreshProfile();
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err: unknown) {
      console.error("Accept invite error:", err);
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setActingInviteId(null);
    }
  }

  async function handleDecline(invite: OrganizationInvite) {
    if (!user || !invite.id || !user.email) return;

    if (!confirm(`Are you sure you want to decline the invitation to ${invite.organizationName}?`)) {
      return;
    }

    try {
      setActingInviteId(invite.id);
      setError("");
      setSuccess("");

      await declineOrganizationInvite(invite.id, user.email);
      setSuccess(`Invitation to ${invite.organizationName} declined.`);
      await loadPendingInvites();
    } catch (err: unknown) {
      console.error("Decline invite error:", err);
      setError(err instanceof Error ? err.message : "Failed to decline invitation.");
    } finally {
      setActingInviteId(null);
    }
  }

  return (
    <Layout title="Invitations">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Dashboard
          </button>
          <h1 className="mt-4 text-3xl font-bold">Organisation Invitations</h1>
          <p className="mt-1 text-gray-400">
            Invitations to join organisations sent to {user?.email}.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-900 bg-green-950/30 p-4 text-green-300">
            {success}
          </div>
        )}

        {profile?.organizationId && (
          <div className="mb-6 rounded-xl border border-blue-900/50 bg-blue-950/20 p-4 text-sm text-blue-300">
            ℹ️ You currently belong to <strong>{profile.organizationName || "an organisation"}</strong>.
            To join another organisation, you must leave your current organisation first to protect tenant data.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
          </div>
        ) : invites.length === 0 ? (
          <EmptyState
            icon="📨"
            title="No Pending Invitations"
            message="When an administrator invites your email address to their organisation, it will appear here."
          />
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => {
              const roleLabel =
                invite.role === "admin"
                  ? "Administrator"
                  : invite.role === "staff"
                  ? "Staff (Case Management)"
                  : "Member";

              return (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-6 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        Invitation
                      </span>
                      <h2 className="mt-1 text-xl font-bold text-white">
                        {invite.organizationName}
                      </h2>
                      <p className="mt-1 text-sm text-gray-400">
                        Invited by{" "}
                        <span className="text-gray-200">
                          {invite.invitedByName || "an administrator"}
                        </span>
                        {invite.createdAt && (
                          <span> • {formatRelativeTime(invite.createdAt)}</span>
                        )}
                      </p>
                    </div>

                    <span className="rounded-full border border-indigo-800 bg-indigo-950/40 px-3 py-1 text-xs font-semibold text-indigo-300">
                      Offered Role: {roleLabel}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleAccept(invite)}
                      disabled={actingInviteId === invite.id}
                      className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                    >
                      {actingInviteId === invite.id ? "Accepting..." : "Accept Invitation"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDecline(invite)}
                      disabled={actingInviteId === invite.id}
                      className="rounded-xl border border-gray-700 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
