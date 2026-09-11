"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportCard } from "@/src/components/ReportCard";
import { ReportFilters } from "@/src/components/ReportFilters";
import { EmptyState } from "@/src/components/EmptyState";

interface BrowseReport {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  confirmationCount?: number;
  assignedToName?: string | null;
  escalationLevel?: number;
  createdAt?: { toDate(): Date } | null;
}

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<BrowseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadReports = useCallback(async (isMore = false) => {
    if (!profile?.organizationId) return;
    try {
      if (isMore) setLoadingMore(true); else setLoading(true);
      setError("");

      const q = isMore && lastDoc
        ? query(collection(db, "reports"), where("organizationId", "==", profile.organizationId), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
        : query(collection(db, "reports"), where("organizationId", "==", profile.organizationId), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as BrowseReport));

      if (isMore) setReports((p) => [...p, ...items]); else setReports(items);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Browse reports error:", err);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile, lastDoc]);

  useEffect(() => {
    if (profile?.organizationId) loadReports(false);
    else setLoading(false);
  }, [profile]);

  // Client-side filtering
  const filtered = reports.filter((r) => {
    if (category && r.category !== category) return false;
    if (severity && r.severity !== severity) return false;
    if (status && r.status !== status) return false;
    if (search) {
      const t = search.toLowerCase();
      if (!r.title?.toLowerCase().includes(t) && !r.description?.toLowerCase().includes(t)) return false;
    }
    if (dateFrom && r.createdAt) {
      const d = "toDate" in r.createdAt ? r.createdAt.toDate() : r.createdAt;
      if (d && d < new Date(dateFrom)) return false;
    }
    if (dateTo && r.createdAt) {
      const d = "toDate" in r.createdAt ? r.createdAt.toDate() : r.createdAt;
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      if (d && d > end) return false;
    }
    return true;
  });

  if (!profile?.organizationId) {
    return (
      <Layout title="Browse Reports">
        <EmptyState icon="🏢" title="No Organisation" message="Join an organisation to browse community reports. Check your pending invitations or create a new organisation." />
      </Layout>
    );
  }

  return (
    <Layout title="Browse Reports">
      <div className="mb-6">
        <ReportFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} severity={severity} onSeverityChange={setSeverity} status={status} onStatusChange={setStatus} showDateFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title={reports.length === 0 ? "No reports yet" : "No matching reports"} message={reports.length === 0 ? "Be the first to report an issue in your community." : "Try adjusting your filters."} />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}

      {hasMore && !loading && reports.length > 0 && (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => loadReports(true)} disabled={loadingMore} className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </Layout>
  );
}