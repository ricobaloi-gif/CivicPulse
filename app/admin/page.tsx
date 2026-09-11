"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportFilters } from "@/src/components/ReportFilters";
import { ReportCard } from "@/src/components/ReportCard";
import { EmptyState } from "@/src/components/EmptyState";

interface AdminReport {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  confirmationCount?: number;
  assignedTo?: string | null;
  assignedToName?: string | null;
  escalationLevel?: number;
  createdAt?: { toDate(): Date } | null;
}

const PAGE_SIZE = 20;

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  async function loadReports(isMore = false) {
    if (!profile?.organizationId) return;
    try {
      if (isMore) setLoadingMore(true); else setLoading(true);
      const q = isMore && lastDoc
        ? query(collection(db, "reports"), where("organizationId", "==", profile.organizationId), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
        : query(collection(db, "reports"), where("organizationId", "==", profile.organizationId), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AdminReport));
      if (isMore) setReports((p) => [...p, ...items]); else setReports(items);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Admin load error:", err);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (profile?.organizationId) loadReports(false);
    else setLoading(false);
  }, [profile]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (category && r.category !== category) return false;
      if (severity && r.severity !== severity) return false;
      if (status && r.status !== status) return false;
      if (search) {
        const t = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(t) && !r.description?.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [reports, search, category, severity, status]);

  const awaiting = reports.filter((r) => r.status === "submitted").length;
  const active = reports.filter((r) => r.status !== "resolved" && r.status !== "rejected" && r.status !== "duplicate").length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  const critical = reports.filter((r) => r.severity === "critical" && r.status !== "resolved").length;
  const escalated = reports.filter((r) => (r.escalationLevel ?? 0) > 0).length;

  return (
    <Layout requireRole={["admin"]} title="Operations">
      {!profile?.organizationId ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="text-2xl font-bold mb-2">No Organisation</h2>
          <p className="text-gray-400 mb-6">Set up your organisation to start managing reports.</p>
          <button type="button" onClick={() => router.push("/organization/setup")} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
            Set Up Organisation
          </button>
        </div>
      ) : (
        <>
          {/* Quick action buttons */}
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { href: "/organization/manage", label: "Members", icon: "👥" },
              { href: "/organization/areas", label: "Areas", icon: "📍" },
              { href: "/analytics", label: "Analytics", icon: "📈" },
              { href: "/moderation", label: "Moderation", icon: "🛡️" },
              { href: "/organization/settings", label: "Settings", icon: "⚙️" },
              { href: "/exports", label: "Exports", icon: "📊" },
            ].map((a) => (
              <button key={a.href} type="button" onClick={() => router.push(a.href)} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium hover:bg-gray-800">
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>

          {/* KPI boxes */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-blue-900 bg-blue-950/20 p-5">
              <p className="text-sm text-blue-300">Awaiting Review</p>
              <p className="mt-2 text-3xl font-bold">{awaiting}</p>
            </div>
            <div className="rounded-2xl border border-indigo-900 bg-indigo-950/20 p-5">
              <p className="text-sm text-indigo-300">Active</p>
              <p className="mt-2 text-3xl font-bold">{active}</p>
            </div>
            <div className="rounded-2xl border border-green-900 bg-green-950/20 p-5">
              <p className="text-sm text-green-300">Resolved</p>
              <p className="mt-2 text-3xl font-bold">{resolved}</p>
            </div>
            <div className="rounded-2xl border border-red-900 bg-red-950/20 p-5">
              <p className="text-sm text-red-300">Critical</p>
              <p className="mt-2 text-3xl font-bold">{critical}</p>
            </div>
            <div className="rounded-2xl border border-orange-900 bg-orange-950/20 p-5">
              <p className="text-sm text-orange-300">Escalated</p>
              <p className="mt-2 text-3xl font-bold">{escalated}</p>
            </div>
          </section>

          <div className="mb-6">
            <ReportFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} severity={severity} onSeverityChange={setSeverity} status={status} onStatusChange={setStatus} showDateFilter />
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>}

          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="📋" title="No reports found" message={reports.length === 0 ? "No reports in your organisation yet." : "Try adjusting your filters."} />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => loadReports(true)} disabled={loadingMore} className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}