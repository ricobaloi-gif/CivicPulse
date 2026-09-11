"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportCard } from "@/src/components/ReportCard";
import { ReportFilters } from "@/src/components/ReportFilters";
import { EmptyState } from "@/src/components/EmptyState";

interface ReportItem {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  confirmationCount?: number;
  assignedToName?: string | null;
  createdAt?: { toDate(): Date } | null;
}

const PAGE_SIZE = 20;

export default function MyReportsPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  const loadReports = useCallback(
    async (isLoadMore = false) => {
      if (!user) return;

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError("");

        const q = isLoadMore && lastDoc
          ? query(collection(db, "reports"), where("createdBy", "==", user.uid), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
          : query(collection(db, "reports"), where("createdBy", "==", user.uid), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);

        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ReportItem[];

        if (isLoadMore) {
          setReports((prev) => [...prev, ...items]);
        } else {
          setReports(items);
        }

        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("Load my reports error:", err);
        setError("Failed to load your reports.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, lastDoc]
  );

  useEffect(() => {
    if (user) {
      loadReports(false);
    }
  }, [user]);

  // Client-side filtering
  const filtered = reports.filter((r) => {
    if (category && r.category !== category) return false;
    if (severity && r.severity !== severity) return false;
    if (status && r.status !== status) return false;
    if (search) {
      const term = search.toLowerCase();
      const inTitle = r.title?.toLowerCase().includes(term);
      const inDesc = r.description?.toLowerCase().includes(term);
      if (!inTitle && !inDesc) return false;
    }
    return true;
  });

  return (
    <Layout title="My Reports">
      {error && (
        <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6">
        <ReportFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          severity={severity}
          onSeverityChange={setSeverity}
          status={status}
          onStatusChange={setStatus}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📄"
          title={reports.length === 0 ? "No reports yet" : "No matching reports"}
          message={
            reports.length === 0
              ? "Submit your first report to start tracking community issues."
              : "Try adjusting your filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {hasMore && !loading && reports.length > 0 && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={loadingMore}
            className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </Layout>
  );
}