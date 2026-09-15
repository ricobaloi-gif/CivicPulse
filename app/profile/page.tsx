"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { RoleBadge } from "@/src/components/RoleBadge";
import { formatRelativeTime } from "@/src/lib/constants";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [name, setName] = useState(() => profile?.name || "");
  const [phone, setPhone] = useState(() => profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const profileKey = `${profile?.name || ""}-${profile?.phone || ""}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: name.trim() || null,
        phone: phone.trim() || null,
      });

      setSuccess("Profile updated successfully.");
      await refreshProfile();
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const role = profile?.role?.toLowerCase().trim() || "resident";
  const orgRole = profile?.organizationRole || "member";
  const hasOrg = !!profile?.organizationId;
  const memberSince = profile?.createdAt;
  const joinedOrgAt = profile?.organizationJoinedAt;

  return (
    <Layout title="My Profile">
      <div className="mx-auto max-w-2xl">
        {/* Profile Header */}
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-950 text-3xl">
                {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{profile?.name || "Unnamed User"}</h2>
                <p className="text-gray-400">{user?.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <RoleBadge role={role} />
                  {hasOrg && (
                    <span className="rounded-full border border-indigo-800 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                      {profile?.organizationName} ({orgRole})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300 capitalize">
              {role}
            </span>
          </div>
        </div>

        {/* Alerts */}
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

        {/* Personal Information */}
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-xl font-bold">Personal Information</h3>
          <p className="mt-1 text-sm text-gray-400">Update your display name and contact details.</p>

          <form key={profileKey} onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-semibold">
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 XX XXX XXXX"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        {/* Account Info */}
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-xl font-bold">Account Details</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-950 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">User ID</p>
              <p className="mt-1 font-mono text-sm break-all">{user?.uid}</p>
            </div>
            <div className="rounded-xl bg-gray-950 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Trust Score</p>
              <p className="mt-1 text-2xl font-bold text-amber-300">{profile?.trustScore ?? 50}</p>
            </div>
            {memberSince && (
              <div className="rounded-xl bg-gray-950 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Member Since</p>
                <p className="mt-1 font-semibold">{formatRelativeTime(memberSince)}</p>
              </div>
            )}
            {joinedOrgAt && hasOrg && (
              <div className="rounded-xl bg-gray-950 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Joined Organisation</p>
                <p className="mt-1 font-semibold">{formatRelativeTime(joinedOrgAt)}</p>
              </div>
            )}
          </div>
        </section>

        {/* Organisation Info */}
        {hasOrg && (
          <section className="mb-8 rounded-2xl border border-indigo-900 bg-indigo-950/20 p-6">
            <h3 className="text-xl font-bold">Organisation</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-950 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Organisation</p>
                <p className="mt-1 font-semibold text-indigo-300">{profile?.organizationName}</p>
              </div>
              <div className="rounded-xl bg-gray-950 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Organisation Role</p>
                <p className="mt-1 font-semibold text-indigo-300 capitalize">{orgRole}</p>
              </div>
              <div className="rounded-xl bg-gray-950 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Platform Role</p>
                <p className="mt-1 font-semibold">{profile?.platformRole || "None"}</p>
              </div>
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section className="rounded-2xl border border-red-900 bg-red-950/20 p-6">
          <h3 className="text-xl font-bold text-red-300">Danger Zone</h3>
          <p className="mt-2 text-sm text-gray-400">
            These actions are irreversible. Use with caution.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!hasOrg && (
              <button
                type="button"
                onClick={() => router.push("/organization/invites")}
                className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-950"
              >
                View Pending Invitations
              </button>
            )}
            {hasOrg && (
              <button
                type="button"
                onClick={() => router.push("/organization/manage")}
                className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-semibold hover:bg-gray-800"
              >
                Manage Organisation
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}