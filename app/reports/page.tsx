"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ReportFilters, AreaOption } from "@/src/components/ReportFilters";
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
  areaId?: string | null;
  areaName?: string | null;
  ward?: string | null;
  municipality?: string | null;
  escalationLevel?: number;
  createdAt?: { toDate(): Date } | null;
}

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { profile } = useAuth();
  const organizationId = profile?.organizationId ?? null;

  const [reports, setReports] = useState<BrowseReport[]>([]);
  const [areaList, setAreaList] = useState<AreaOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const [ward, setWard] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!organizationId) return;

    async function loadAreas() {
      try {
        const q = query(
          collection(db, "areas"),
          where("organizationId", "==", organizationId)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AreaOption)
        );
        items.sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(items);
      } catch (err) {
        console.warn("Failed to load areas for browse:", err);
      }
    }

    void loadAreas();
  }, [organizationId]);

  const loadReports = useCallback(
    async (isMore = false) => {
      if (!organizationId) return;

      // Ensure state updates happen asynchronously when invoked from an effect.
      await Promise.resolve();

      try {
        if (isMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          lastDocRef.current = null;
        }
        setError("");

        const cursor = isMore ? lastDocRef.current : null;
        const q =
          cursor
            ? query(
                collection(db, "reports"),
                where("organizationId", "==", organizationId),
                orderBy("createdAt", "desc"),
                startAfter(cursor),
                limit(PAGE_SIZE)
              )
            : query(
                collection(db, "reports"),
                where("organizationId", "==", organizationId),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
              );

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as BrowseReport)
        );

        if (isMore) {
          setReports((previous) => [...previous, ...items]);
        } else {
          setReports(items);
        }

        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("Browse reports error:", err);
        setError("Failed to load reports.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    if (!organizationId) return;

    queueMicrotask(() => {
      void loadReports(false);
    });
  }, [organizationId, loadReports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (category && r.category !== category) return false;
      if (severity && r.severity !== severity) return false;
      if (status && r.status !== status) return false;

      if (areaId) {
        const matchesId = r.areaId === areaId;
        const matchesName = r.areaName?.toLowerCase() === areaId.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      if (ward && !r.ward?.toLowerCase().includes(ward.toLowerCase().trim())) {
        return false;
      }

      if (
        municipality &&
        !r.municipality?.toLowerCase().includes(municipality.toLowerCase().trim())
      ) {
        return false;
      }

      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const idMatch = r.id.toLowerCase().includes(term);
        const titleMatch = r.title?.toLowerCase().includes(term);
        const descMatch = r.description?.toLowerCase().includes(term);
        const wardMatch = r.ward?.toLowerCase().includes(term);
        const areaMatch = r.areaName?.toLowerCase().includes(term);
        if (!idMatch && !titleMatch && !descMatch && !wardMatch && !areaMatch) {
          return false;
        }
      }

      if (dateFrom && r.createdAt) {
        const date = r.createdAt.toDate();
        if (date < new Date(dateFrom)) return false;
      }

      if (dateTo && r.createdAt) {
        const date = r.createdAt.toDate();
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        if (date > end) return false;
      }

      return true;
    });
  }, [
    reports,
    search,
    category,
    severity,
    status,
    areaId,
    ward,
    municipality,
    dateFrom,
    dateTo,
  ]);

  if (!organizationId) {
    return (
      <Layout title="Browse Reports">
        <EmptyState
          icon="org"
          title="No Organisation"
          message="Join an organisation to browse community reports. Check your pending invitations or create a new organisation."
        />
      </Layout>
    );
  }

  return (
    <Layout title="Browse Reports">
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
          areaId={areaId}
          onAreaIdChange={setAreaId}
          areaList={areaList}
          ward={ward}
          onWardChange={setWard}
          municipality={municipality}
          onMunicipalityChange={setMunicipality}
          showDateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger-muted/30 p-4 text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="reports"
          title={reports.length === 0 ? "No reports yet" : "No matching reports"}
          message={
            reports.length === 0
              ? "Be the first to report an issue in your community."
              : "Try adjusting your search criteria or filters."
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              Showing {filtered.length} report{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          {filtered.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {hasMore && !loading && reports.length > 0 && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void loadReports(true)}
            disabled={loadingMore}
            className="btn-secondary"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </Layout>
  );
}
