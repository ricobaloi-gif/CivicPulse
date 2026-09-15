"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { EmptyState } from "@/src/components/EmptyState";
import { RoleBadge } from "@/src/components/RoleBadge";
import { formatRelativeTime } from "@/src/lib/constants";
import {
  createOrganizationInvite,
  cancelOrganizationInvite,
} from "@/src/lib/invitations";
import { createAuditLog } from "@/src/lib/auditLog";
import type {
  Organization,
  OrganizationInvite,
  OrganizationRole,
  UserProfile,
} from "@/src/lib/types";

export default function OrganizationManagePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "admin" | "member">("staff");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOrgData = useCallback(async (orgId: string) => {
    try {
      setLoading(true);
      setError("");

      // 1. Fetch organization details
      const orgRef = doc(db, "organizations", orgId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        setOrganization({ id: orgSnap.id, ...orgSnap.data() } as Organization);
      }

      // 2. Fetch current members
      const membersQuery = query(
        collection(db, "users"),
        where("organizationId", "==", orgId)
      );
      const membersSnap = await getDocs(membersQuery);
      const membersList = membersSnap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
      })) as UserProfile[];

      membersList.sort((a, b) => {
        const nameA = a.name || a.email || "";
        const nameB = b.name || b.email || "";
        return nameA.localeCompare(nameB);
      });
      setMembers(membersList);

      // 3. Fetch pending invitations
      const invitesQuery = query(
        collection(db, "organizationInvites"),
        where("organizationId", "==", orgId),
        where("status", "==", "pending")
      );
      const invitesSnap = await getDocs(invitesQuery);
      const invitesList = invitesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as OrganizationInvite[];

      setPendingInvites(invitesList);
    } catch (err) {
      console.error("Organisation management load error:", err);
      setError("Unable to load organisation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const organizationId = profile?.organizationId;

    queueMicrotask(() => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      void loadOrgData(organizationId);
    });
  }, [profile?.organizationId, loadOrgData]);

  // Send invitation
  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile?.organizationId || !organization) return;

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setInviting(true);
      setError("");
      setSuccess("");

      const inviterName = profile.name?.trim() || user.email || "Admin";

      await createOrganizationInvite({
        organizationId: organization.id || profile.organizationId,
        organizationName: organization.name,
        email: trimmedEmail,
        targetRole: inviteRole,
        invitedBy: user.uid,
        invitedByName: inviterName,
        invitedByRole: profile.role || "admin",
      });

      setSuccess(`Invitation successfully sent to ${trimmedEmail}.`);
      setInviteEmail("");
      if (profile?.organizationId) await loadOrgData(profile.organizationId);
    } catch (err: unknown) {
      console.error("Invite error:", err);
      setError(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  }

  // Cancel invitation
  async function handleCancelInvite(invite: OrganizationInvite) {
    if (!user || !profile?.organizationId || !invite.id) return;

    try {
      setCancellingInviteId(invite.id);
      setError("");
      setSuccess("");

      await cancelOrganizationInvite(
        invite.id,
        profile.organizationId,
        user.uid,
        profile.name || user.email || "Admin",
        profile.role || "admin"
      );

      setSuccess(`Invitation for ${invite.email} was cancelled.`);
      if (profile?.organizationId) await loadOrgData(profile.organizationId);
    } catch (err: unknown) {
      console.error("Cancel invite error:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel invitation.");
    } finally {
      setCancellingInviteId(null);
    }
  }

  // Remove member
  async function handleRemoveMember(member: UserProfile) {
    if (!user || !organization || !profile?.organizationId) return;

    if (member.uid === organization.ownerId) {
      setError("The organisation owner cannot be removed.");
      return;
    }

    if (member.uid === user.uid) {
      setError("You cannot remove yourself from here.");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.name || member.email} from the organisation?`)) {
      return;
    }

    try {
      setUpdatingMemberId(member.uid);
      setError("");
      setSuccess("");

      const memberRef = doc(db, "users", member.uid);
      await updateDoc(memberRef, {
        organizationId: null,
        organizationName: null,
        organizationRole: null,
        organizationJoinedAt: null,
        role: "resident",
      });

      await createAuditLog({
        organizationId: profile.organizationId,
        action: "member_removed",
        entityType: "user",
        entityId: member.uid,
        performedBy: user.uid,
        performedByName: profile.name || user.email || "Admin",
        performedByRole: profile.role || "admin",
        metadata: {
          removedMemberEmail: member.email,
          previousRole: member.role,
        },
      });

      setSuccess(`${member.name || member.email} was removed from ${organization.name}.`);
      if (profile?.organizationId) await loadOrgData(profile.organizationId);
    } catch (err) {
      console.error("Remove member error:", err);
      setError("Failed to remove this member.");
    } finally {
      setUpdatingMemberId(null);
    }
  }

  // Change member role
  async function handleChangeMemberRole(
    member: UserProfile,
    newRole: "staff" | "admin" | "resident"
  ) {
    if (!user || !organization || !profile?.organizationId) return;

    if (member.uid === organization.ownerId) {
      setError("The organisation owner's role cannot be modified.");
      return;
    }

    try {
      setUpdatingMemberId(member.uid);
      setError("");
      setSuccess("");

      let orgRole: OrganizationRole = "member";
      if (newRole === "admin") orgRole = "admin";
      if (newRole === "staff") orgRole = "staff";

      const memberRef = doc(db, "users", member.uid);
      await updateDoc(memberRef, {
        role: newRole,
        organizationRole: orgRole,
      });

      await createAuditLog({
        organizationId: profile.organizationId,
        action: "org_settings_changed",
        entityType: "user",
        entityId: member.uid,
        performedBy: user.uid,
        performedByName: profile.name || user.email || "Admin",
        performedByRole: profile.role || "admin",
        metadata: {
          action: "member_role_changed",
          memberEmail: member.email,
          newRole,
          newOrgRole: orgRole,
        },
      });

      setSuccess(`Role updated to ${newRole} for ${member.name || member.email}.`);
      if (profile?.organizationId) await loadOrgData(profile.organizationId);
    } catch (err) {
      console.error("Update role error:", err);
      setError("Failed to update member role.");
    } finally {
      setUpdatingMemberId(null);
    }
  }

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const s = search.toLowerCase().trim();
    return members.filter((m) => {
      const name = m.name?.toLowerCase() || "";
      const email = m.email?.toLowerCase() || "";
      const role = m.role?.toLowerCase() || "";
      return name.includes(s) || email.includes(s) || role.includes(s);
    });
  }, [members, search]);

  if (!profile?.organizationId) {
    return (
      <Layout requireRole={["admin"]} title="Organisation">
        <EmptyState
          icon="🏢"
          title="No Organisation"
          message="Create an organisation first before managing members and invitations."
        />
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.push("/organization/setup")}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Create Organisation
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireRole={["admin"]} title="Organisation Team">
      <div className="mx-auto max-w-6xl">
        {/* Navigation bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Operations
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/organization/areas")}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-semibold hover:bg-gray-800"
            >
              📍 Manage Areas
            </button>
            <button
              type="button"
              onClick={() => router.push("/organization/api")}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-semibold hover:bg-gray-800"
            >
              🔑 API Keys
            </button>
          </div>
        </div>

        {/* Org Header */}
        <header className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Organisation Team Management
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {organization?.name || profile.organizationName || "Your Organisation"}
          </h1>
          {organization?.description && (
            <p className="mt-2 text-gray-400">{organization.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {organization?.type && (
              <span className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-gray-300">
                {organization.type}
              </span>
            )}
            {organization?.city && (
              <span className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-gray-300">
                📍 {organization.city}
              </span>
            )}
            <span className="rounded-md border border-green-800 bg-green-950/40 px-3 py-1 font-semibold text-green-300">
              👥 {members.length} Member{members.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-md border border-amber-800 bg-amber-950/40 px-3 py-1 font-semibold text-amber-300">
              📨 {pendingInvites.length} Pending Invite{pendingInvites.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* Feedback alerts */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-green-900 bg-green-950/30 p-4 text-green-300">
            {success}
          </div>
        )}

        {/* Invite New Member Section */}
        <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-bold">Invite Member by Email</h2>
          <p className="mt-1 text-sm text-gray-400">
            Send an invitation to join your organisation. The user will receive an in-app invite and must securely accept it.
          </p>

          <form onSubmit={handleSendInvite} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "staff" | "admin" | "member")}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="staff">Staff (Case Management)</option>
              <option value="admin">Admin (Full Org Control)</option>
              <option value="member">Member (Resident/Viewer)</option>
            </select>

            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
        </section>

        {/* Pending Invitations Section */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Pending Invitations ({pendingInvites.length})
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            {pendingInvites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                No pending invitations. Use the form above to invite team members.
              </div>
            ) : (
              pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{invite.email}</span>
                      <span className="rounded-full border border-amber-800 bg-amber-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                        Pending
                      </span>
                      <span className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300 capitalize">
                        Role: {invite.role || invite.organizationRole}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {invite.invitedByName && <span>Invited by {invite.invitedByName} • </span>}
                      {invite.createdAt && <span>Sent {formatRelativeTime(invite.createdAt)}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCancelInvite(invite)}
                    disabled={cancellingInviteId === invite.id}
                    className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
                  >
                    {cancellingInviteId === invite.id ? "Cancelling..." : "Cancel Invite"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Current Team Members Section */}
        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Team Members ({members.length})</h2>
              <p className="mt-1 text-sm text-gray-400">
                Accounts active in this organisation.
              </p>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full sm:w-64 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
                No members found matching your search.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isOwner = member.uid === organization?.ownerId;
                const isSelf = member.uid === user?.uid;

                return (
                  <div
                    key={member.uid}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-bold text-white">
                          {member.name || member.email || "Unnamed Member"}
                        </p>

                        <RoleBadge role={member.role || "resident"} />

                        {isOwner && (
                          <span className="rounded-full border border-yellow-800 bg-yellow-950/40 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
                            Owner
                          </span>
                        )}

                        {isSelf && (
                          <span className="rounded-full border border-blue-800 bg-blue-950/40 px-2.5 py-0.5 text-xs text-blue-300">
                            You
                          </span>
                        )}
                      </div>

                      {member.email && (
                        <p className="mt-1 text-sm text-gray-400">{member.email}</p>
                      )}

                      <p className="mt-1 text-xs text-gray-500">
                        Org Role: {member.organizationRole || "member"}
                        {member.organizationJoinedAt && (
                          <span> • Joined {formatRelativeTime(member.organizationJoinedAt)}</span>
                        )}
                      </p>
                    </div>

                    {!isOwner && !isSelf && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={member.role || "resident"}
                          onChange={(e) =>
                            handleChangeMemberRole(
                              member,
                              e.target.value as "staff" | "admin" | "resident"
                            )
                          }
                          disabled={updatingMemberId === member.uid}
                          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                          <option value="resident">Member</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          disabled={updatingMemberId === member.uid}
                          className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"
                        >
                          {updatingMemberId === member.uid ? "Updating..." : "Remove"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}