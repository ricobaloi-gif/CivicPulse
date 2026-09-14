"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { EmptyState } from "@/src/components/EmptyState";
import { formatRelativeTime } from "@/src/lib/constants";

interface ApiKeyDisplay {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  permissions: string[];
  createdAt: Date;
  createdBy: string;
  lastUsedAt?: Date;
  revokedAt?: Date;
  isNew?: boolean;
  rawKey?: string;
}

export default function OrganizationApiPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [apiKeys, setApiKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [updatingNameId, setUpdatingNameId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [editName, setEditName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ rawKey: string; prefix: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authenticatedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (!user) {
        throw new Error("You must be signed in to manage API keys.");
      }

      const idToken = await user.getIdToken();

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${idToken}`);

      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [user]
  );

  const loadApiKeys = useCallback(async () => {
    if (!user || !profile?.organizationId) return;

    try {
      setLoading(true);
      setError("");

      const response = await authenticatedFetch("/api/admin/api-keys");

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to load API keys");
      }

      const payload = await response.json();
      const data = payload.data ?? payload;
      setApiKeys(
        (data.apiKeys ?? []).map((k: any) => ({
          ...k,
          createdAt: k.createdAt?.toDate ? k.createdAt.toDate() : new Date(k.createdAt),
          lastUsedAt: k.lastUsedAt?.toDate ? k.lastUsedAt.toDate() : k.lastUsedAt ? new Date(k.lastUsedAt) : undefined,
          revokedAt: k.revokedAt?.toDate ? k.revokedAt.toDate() : k.revokedAt ? new Date(k.revokedAt) : undefined,
        }))
      );
    } catch (err) {
      console.error("Load API keys error:", err);
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [user, profile?.organizationId, authenticatedFetch]);

  useEffect(() => {
    if (user && profile?.organizationId) {
      loadApiKeys();
    } else {
      setLoading(false);
    }
  }, [user, profile?.organizationId, loadApiKeys]);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile?.organizationId || !newKeyName.trim()) return;

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const response = await authenticatedFetch("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Failed to create API key");
      }

      const data = payload.data ?? payload;
      setNewKeyData({ rawKey: data.rawKey, prefix: data.prefix });
      setShowNewKeyModal(true);
      setNewKeyName("");
      await loadApiKeys();
    } catch (err) {
      console.error("Create API key error:", err);
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!user || !profile?.organizationId) return;

    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      setRevokingId(keyId);
      setError("");
      setSuccess("");

      const response = await authenticatedFetch(`/api/admin/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to revoke API key");
      }

      setSuccess("API key revoked successfully");
      await loadApiKeys();
    } catch (err) {
      console.error("Revoke API key error:", err);
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleUpdateName(keyId: string) {
    if (!user || !profile?.organizationId || !editName.trim()) return;

    try {
      setUpdatingNameId(keyId);
      setError("");
      setSuccess("");

      const response = await authenticatedFetch(`/api/admin/api-keys/${keyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to update API key name");
      }

      setSuccess("API key name updated");
      setEditingId(null);
      setEditName("");
      await loadApiKeys();
    } catch (err) {
      console.error("Update API key name error:", err);
      setError(err instanceof Error ? err.message : "Failed to update API key name");
    } finally {
      setUpdatingNameId(null);
    }
  }

  function startEditName(key: ApiKeyDisplay) {
    setEditingId(key.id);
    setEditName(key.name);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setSuccess("API key copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  }

  function formatDate(date?: Date): string {
    if (!date) return "Never";
    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!profile?.organizationId) {
    return (
      <Layout requireRole={["admin"]} title="API Keys">
        <EmptyState
          icon="🔑"
          title="No Organisation"
          message="Join an organisation to manage API keys."
        />
      </Layout>
    );
  }

  return (
    <Layout requireRole={["admin"]} title="API Keys">
      <div className="mx-auto max-w-4xl">
        {/* Navigation */}
        <div className="mb-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Operations
          </button>
        </div>

        {/* Header */}
        <header className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">API Key Management</p>
          <h1 className="mt-2 text-3xl font-bold">Manage API Keys</h1>
          <p className="mt-2 text-gray-400">
            Create and manage API keys for external integrations. Keys are organisation-scoped and
            provide secure access to the CivicPulse REST API.
          </p>
        </header>

        {/* Feedback */}
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

        {/* Create Key Form */}
        <section className="mb-10 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-bold">Create New API Key</h2>
          <p className="mt-1 text-sm text-gray-400">
            Give your key a descriptive name to identify its purpose (e.g., "Mobile App", "CI/CD Pipeline", "Partner Integration").
          </p>

          <form onSubmit={handleCreateKey} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Mobile App Integration"
              required
              maxLength={100}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={creating || !newKeyName.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create API Key"}
            </button>
          </form>
        </section>

        {/* Existing Keys */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your API Keys ({apiKeys.length})</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center text-sm text-gray-500">
              No API keys yet. Create your first key using the form above.
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-950/30 text-blue-300">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <div>
                        {editingId === key.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateName(key.id)}
                            onBlur={() => setEditingId(null)}
                            autoFocus
                            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-base font-semibold outline-none focus:border-blue-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{key.name}</span>
                            <span className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs font-mono text-gray-300">
                              {key.prefix}...
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                key.active
                                  ? "border-green-800 bg-green-950/40 text-green-300"
                                  : "border-red-800 bg-red-950/40 text-red-300"
                              }`}
                            >
                              {key.active ? "Active" : "Revoked"}
                            </span>
                          </div>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Created {formatDate(key.createdAt)}
                          {key.lastUsedAt && <span> • Last used {formatRelativeTime(key.lastUsedAt)}</span>}
                          {key.revokedAt && <span> • Revoked {formatRelativeTime(key.revokedAt)}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {editingId === key.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateName(key.id)}
                            disabled={updatingNameId === key.id || !editName.trim()}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {updatingNameId === key.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : key.active ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditName(key)}
                            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={revokingId === key.id}
                            className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
                          >
                            {revokingId === key.id ? "Revoking..." : "Revoke"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">This key has been revoked</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">
                      Permissions: {key.permissions.join(", ") || "None"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* API Documentation Link */}
        <section className="mt-10 rounded-2xl border border-gray-800 bg-gray-950/50 p-6">
          <h3 className="text-lg font-bold">API Documentation</h3>
          <p className="mt-2 text-sm text-gray-400">
            View the complete API reference with endpoints, request/response examples, and authentication details.
          </p>
          <a
            href="/API.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View API Documentation
          </a>
        </section>
      </div>

      {/* New Key Modal */}
      {showNewKeyModal && newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">API Key Created</h3>
            </div>

            <div className="mb-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-amber-300">
              <p className="font-semibold">This is the only time you will see the full API key.</p>
              <p className="mt-2 text-sm">Copy and store it securely. It cannot be recovered.</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyData.rawKey}
                  readOnly
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newKeyData.rawKey)}
                  className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Key Prefix (for identification)
              </label>
              <code className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-mono text-gray-300">
                {newKeyData.prefix}...
              </code>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNewKeyModal(false);
                setNewKeyData(null);
              }}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500"
            >
              I've saved the key, close this
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}