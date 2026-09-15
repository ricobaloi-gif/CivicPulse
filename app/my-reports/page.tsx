"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  const userRef = useRef(user);
  const profileRef = useRef(profile);
  const lastDocRef = useRef(lastDoc);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { lastDocRef.current = lastDoc; }, [lastDoc]);

  const loadReports = useCallback(
    async (isLoadMore = false) => {
      const currentUser = userRef.current;
      const currentProfile = profileRef.current;
      if (!currentUser || !currentProfile?.organizationId) {
        setLoading(false);
        return;
      }

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        setError("");

        const reportsQuery =
          isLoadMore && lastDocRef.current
            ? query(
                collection(db, "reports"),
                where("organizationId", "==", currentProfile.organizationId),
                where("createdBy", "==", currentUser.uid),
                orderBy("createdAt", "desc"),
                startAfter(lastDocRef.current),
                limit(PAGE_SIZE)
              )
            : query(
                collection(db, "reports"),
                where("organizationId", "==", currentProfile.organizationId),
                where("createdBy", "==", currentUser.uid),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
              );

        const snapshot = await getDocs(reportsQuery);

        const items = snapshot.docs.map(
          (reportDoc) =>
            ({
              id: reportDoc.id,
              ...reportDoc.data(),
            }) as ReportItem
        );

        if (isLoadMore) {
          setReports((previousReports) => [
            ...previousReports,
            ...items,
          ]);
        } else {
          setReports(items);
        }

        setLastDoc(
          snapshot.docs[snapshot.docs.length - 1] ?? null
        );

        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("Load my reports error:", err);
        setError("Failed to load your reports.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const currentUser = userRef.current;
    const currentProfile = profileRef.current;
    if (!currentUser) return;
    if (!currentProfile?.organizationId) {
      setLoading(false);
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadReports(false);
  }, [user, profile?.organizationId, loadReports]);

  const filtered = reports.filter((report) => {
    if (category && report.category !== category) {
      return false;
    }

    if (severity && report.severity !== severity) {
      return false;
    }

    if (status && report.status !== status) {
      return false;
    }

    if (search.trim()) {
      const term = search.toLowerCase().trim();

      const idMatch = report.id
        .toLowerCase()
        .includes(term);

      const titleMatch = report.title
        ?.toLowerCase()
        .includes(term);

      const descriptionMatch = report.description
        ?.toLowerCase()
        .includes(term);

      if (!idMatch && !titleMatch && !descriptionMatch) {
        return false;
      }
    }

    return true;
  });

  if (user && profile && !profile.organizationId) {
    return (
      <Layout title="My Reports">
        <EmptyState
          icon="org"
          title="No Organisation"
          message="Join an organisation before viewing organisation reports."
        />
      </Layout>
    );
  }

  return (
    <Layout title="My Reports">
      {error && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger-muted/30 p-4 text-danger">
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title={
            reports.length === 0
              ? "No reports yet"
              : "No matching reports"
          }
          message={
            reports.length === 0
              ? "Submit your first report to start tracking community issues."
              : "Try adjusting your filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
            />
          ))}
        </div>
      )}

      {hasMore &&
        !loading &&
        reports.length > 0 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => loadReports(true)}
              disabled={loadingMore}
              className="btn-secondary"
            >
              {loadingMore
                ? "Loading..."
                : "Load More"}
            </button>
          </div>
        )}
    </Layout>
  );
}