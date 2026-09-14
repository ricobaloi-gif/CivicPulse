"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportFilters, StaffOption, AreaOption } from "@/src/components/ReportFilters";
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
  areaId?: string | null;
  areaName?: string | null;
  ward?: string | null;
  municipality?: string | null;
  escalationLevel?: number;
  escalated?: boolean;
  escalationReason?: string | null;
  createdAt?: { toDate(): Date } | null;
}

const PAGE_SIZE = 25;

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [areaList, setAreaList] = useState<AreaOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [assignedStaff, setAssignedStaff] = useState("");
  const [areaId, setAreaId] = useState("");
  const [ward, setWard] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Load staff and areas for the organisation
  useEffect(() => {
    if (!profile?.organizationId) return;

    async function loadMetadata() {
      try {
        const orgId = profile!.organizationId!;

        // Staff
        const staffQuery = query(
          collection(db, "users"),
          where("organizationId", "==", orgId)
        );
        const staffSnap = await getDocs(staffQuery);
        const staffMembers = staffSnap.docs
          .map((d) => ({ uid: d.id, ...d.data() } as StaffOption & { role?: string }))
          .filter((u) => u.role === "staff" || u.role === "admin");
        setStaffList(staffMembers);

        // Areas
        const areasQuery = query(
          collection(db, "areas"),
          where("organizationId", "==", orgId)
        );
        const areasSnap = await getDocs(areasQuery);
        const areas = areasSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AreaOption)
        );
        areas.sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(areas);
      } catch (err) {
        console.warn("Failed to load operations metadata:", err);
      }
    }

    loadMetadata();
  }, [profile?.organizationId]);

  const loadReports = useCallback(
    async (isMore = false) => {
      if (!profile?.organizationId) return;
      try {
        if (isMore) setLoadingMore(true);
        else setLoading(true);

        const q =
          isMore && lastDoc
            ? query(
                collection(db, "reports"),
                where("organizationId", "==", profile.organizationId),
                orderBy("createdAt", "desc"),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
              )
            : query(
                collection(db, "reports"),
                where("organizationId", "==", profile.organizationId),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
              );

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AdminReport)
        );

        if (isMore) setReports((p) => [...p, ...items]);
        else setReports(items);

        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("Admin load error:", err);
        setError("Failed to load reports.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [profile?.organizationId, lastDoc]
  );

  useEffect(() => {
    if (profile?.organizationId) loadReports(false);
    else setLoading(false);
  }, [profile?.organizationId]);

  // Comprehensive client-side multi-field filtering
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      // 1. Category
      if (category && r.category !== category) return false;

      // 2. Severity
      if (severity && r.severity !== severity) return false;

      // 3. Status
      if (status && r.status !== status) return false;

      // 4. Assigned Staff
      if (assignedStaff) {
        if (assignedStaff === "unassigned") {
          if (r.assignedTo) return false;
        } else if (r.assignedTo !== assignedStaff) {
          return false;
        }
      }

      // 5. Area / Ward
      if (areaId) {
        const matchesAreaId = r.areaId === areaId;
        const matchesAreaName = r.areaName?.toLowerCase() === areaId.toLowerCase();
        if (!matchesAreaId && !matchesAreaName) return false;
      }

      if (ward && !r.ward?.toLowerCase().includes(ward.toLowerCase().trim())) {
        return false;
      }

      // 6. Municipality
      if (
        municipality &&
        !r.municipality?.toLowerCase().includes(municipality.toLowerCase().trim())
      ) {
        return false;
      }

      // 7. Search (report ID, title, description)
      if (search.trim()) {
        const t = search.toLowerCase().trim();
        const idMatch = r.id.toLowerCase().includes(t);
        const titleMatch = r.title?.toLowerCase().includes(t);
        const descMatch = r.description?.toLowerCase().includes(t);
        const wardMatch = r.ward?.toLowerCase().includes(t);
        const areaMatch = r.areaName?.toLowerCase().includes(t);
        if (!idMatch && !titleMatch && !descMatch && !wardMatch && !areaMatch) {
          return false;
        }
      }

      // 8. Date range filtering
      if (dateFrom && r.createdAt) {
        const d = "toDate" in r.createdAt ? r.createdAt.toDate() : r.createdAt;
        if (d && d < new Date(dateFrom)) return false;
      }
      if (dateTo && r.createdAt) {
        const d = "toDate" in r.createdAt ? r.createdAt.toDate() : r.createdAt;
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1); // inclusive of day
        if (d && d > end) return false;
      }

      return true;
    });
  }, [
    reports,
    search,
    category,
    severity,
    status,
    assignedStaff,
    areaId,
    ward,
    municipality,
    dateFrom,
    dateTo,
  ]);

  const awaiting = reports.filter((r) => r.status === "submitted").length;
  const active = reports.filter(
    (r) => r.status !== "resolved" && r.status !== "rejected" && r.status !== "duplicate"
  ).length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  const critical = reports.filter(
    (r) => r.severity === "critical" && r.status !== "resolved"
  ).length;
  const escalated = reports.filter((r) => (r.escalationLevel ?? 0) > 0).length;

  return (
    <Layout requireRole={["admin"]} title="Operations">
      {!profile?.organizationId ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">🏢</div>
          <h2 className="mb-2 text-2xl font-bold">No Organisation</h2>
          <p className="mb-6 text-gray-400">
            Set up your organisation to start managing reports.
          </p>
          <button
            type="button"
            onClick={() => router.push("/organization/setup")}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Set Up Organisation
          </button>
        </div>
      ) : (
        <>
          {/* Quick action buttons */}
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { href: "/organization/manage", label: "Members & Invites", icon: "👥" },
              { href: "/organization/areas", label: "Wards & Areas", icon: "📍" },
              { href: "/organization/api", label: "API Keys", icon: "🔑" },
              { href: "/map", label: "Map View", icon: "🗺️" },
              { href: "/reports", label: "Public Reports", icon: "📋" },
            ].map((a) => (
              <button
                key={a.href}
                type="button"
                onClick={() => router.push(a.href)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium hover:bg-gray-800"
              >
                <span>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>

          {/* KPI metrics */}
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
              <p className="text-sm text-red-300">Critical Open</p>
              <p className="mt-2 text-3xl font-bold">{critical}</p>
            </div>
            <div className="rounded-2xl border border-orange-900 bg-orange-950/20 p-5">
              <p className="text-sm text-orange-300">Escalated</p>
              <p className="mt-2 text-3xl font-bold">{escalated}</p>
            </div>
          </section>

          {/* Advanced Search & Filters */}
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
              assignedStaff={assignedStaff}
              onAssignedStaffChange={setAssignedStaff}
              staffList={staffList}
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
            <div className="mb-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No reports found"
              message={
                reports.length === 0
                  ? "No reports in your organisation yet."
                  : "Try adjusting your search criteria or filters."
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Showing {filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              {filtered.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}

          {hasMore && !loading && (
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
        </>
      )}
    </Layout>
  );
}