"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ORGANIZATION_TYPES } from "@/src/lib/constants";

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("Municipality");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (profile?.organizationId) {
    return (
      <Layout title="Organisation Setup">
        <div className="mx-auto max-w-lg text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Already in an Organisation</h2>
          <p className="text-gray-400 mb-6">You belong to <strong className="text-white">{profile.organizationName}</strong>.</p>
          <button type="button" onClick={() => router.push("/organization/manage")} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
            Manage Organisation
          </button>
        </div>
      </Layout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError("");

    try {
      const orgRef = await addDoc(collection(db, "organizations"), {
        name: name.trim(),
        type,
        description: description.trim(),
        city: city.trim(),
        province: province.trim(),
        country: country.trim(),
        ownerId: user.uid,
        createdBy: user.uid,
        status: "active",
        memberCount: 1,
        plan: "pilot",
        subscriptionStatus: "active",
        subscriptionStartedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update user: set org fields AND promote to admin if resident (bootstrap fix)
      const userUpdate: Record<string, unknown> = {
        organizationId: orgRef.id,
        organizationName: name.trim(),
        organizationRole: "owner",
        organizationJoinedAt: serverTimestamp(),
      };

      // Bootstrap: creating an org promotes the user to admin
      if (profile?.role === "resident" || !profile?.role) {
        userUpdate.role = "admin";
      }

      await updateDoc(doc(db, "users", user.uid), userUpdate);
      await refreshProfile();
      router.push("/dashboard");
    } catch (err) {
      console.error("Org setup error:", err);
      setError("Failed to create organisation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Create Organisation">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">New Organisation</p>
          <h2 className="mt-2 text-2xl font-bold">Set up your organisation</h2>
          <p className="mt-2 text-gray-400">Create an organisation to manage civic reports for your community.</p>

          {error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-400">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="org-name" className="mb-2 block text-sm font-semibold">Organisation Name *</label>
              <input id="org-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="e.g. City of Johannesburg" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
            </div>

            <div>
              <label htmlFor="org-type" className="mb-2 block text-sm font-semibold">Organisation Type *</label>
              <select id="org-type" value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500">
                {ORGANIZATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="org-desc" className="mb-2 block text-sm font-semibold">Description</label>
              <textarea id="org-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} placeholder="Brief description of your organisation..." className="w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="org-city" className="mb-2 block text-sm font-semibold">City</label>
                <input id="org-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Johannesburg" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="org-province" className="mb-2 block text-sm font-semibold">Province</label>
                <input id="org-province" type="text" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Gauteng" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="org-country" className="mb-2 block text-sm font-semibold">Country</label>
                <input id="org-country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
              </div>
            </div>

            <button type="submit" disabled={loading || !name.trim()} className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Creating..." : "Create Organisation"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}