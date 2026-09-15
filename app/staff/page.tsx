"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportFilters, AreaOption } from "@/src/components/ReportFilters";
import { ReportCard } from "@/src/components/ReportCard";
import { EmptyState } from "@/src/components/EmptyState";

interface StaffReport {
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

export default function StaffPage() {
  const { user, profile } = useAuth();
  const userId = user?.uid ?? null;
  const organizationId = profile?.organizationId ?? null;

  const [reports, setReports] = useState<StaffReport[]>([]);
  const [areaList, setAreaList] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!userId || !organizationId) return;

    async function fetchCases() {
      await Promise.resolve();

      try {
        setLoading(true);
        setError("");

        const reportsQuery = query(
          collection(db, "reports"),
          where("organizationId", "==", organizationId)
        );
        const snapshot = await getDocs(reportsQuery);
        const all = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as StaffReport))
          .filter((report) => report.assignedTo === userId)
          .sort((a, b) => {
            const first =
              a.createdAt && "toDate" in a.createdAt
                ? a.createdAt.toDate().getTime()
                : 0;
            const second =
              b.createdAt && "toDate" in b.createdAt
                ? b.createdAt.toDate().getTime()
                : 0;
            return second - first;
          });

        setReports(all);

        const areasQuery = query(
          collection(db, "areas"),
          where("organizationId", "==", organizationId)
        );
        const areasSnap = await getDocs(areasQuery);
        const areas = areasSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AreaOption)
        );
        areas.sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(areas);
      } catch (err) {
        console.error("Staff fetch error:", err);
        setError("Unable to load your assigned cases.");
      } finally {
        setLoading(false);
      }
    }

    void fetchCases();
  }, [userId, organizationId]);

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      if (category && report.category !== category) return false;
      if (severity && report.severity !== severity) return false;
      if (status && report.status !== status) return false;

      if (areaId) {
        const matchesId = report.areaId === areaId;
        const matchesName =
          report.areaName?.toLowerCase() === areaId.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      if (
        ward &&
        !report.ward?.toLowerCase().includes(ward.toLowerCase().trim())
      ) {
        return false;
      }

      if (
        municipality &&
        !report.municipality
          ?.toLowerCase()
          .includes(municipality.toLowerCase().trim())
      ) {
        return false;
      }

      if (search) {
        const term = search.toLowerCase().trim();
        const idMatch = report.id.toLowerCase().includes(term);
        const titleMatch = report.title?.toLowerCase().includes(term);
        const descMatch = report.description?.toLowerCase().includes(term);
        const wardMatch = report.ward?.toLowerCase().includes(term);
        const areaMatch = report.areaName?.toLowerCase().includes(term);
        if (!idMatch && !titleMatch && !descMatch && !wardMatch && !areaMatch) {
          return false;
        }
      }

      if (dateFrom && report.createdAt) {
        const date = report.createdAt.toDate();
        if (date < new Date(dateFrom)) return false;
      }

      if (dateTo && report.createdAt) {
        const date = report.createdAt.toDate();
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

  const active = reports.filter(
    (report) => report.status !== "resolved" && report.status !== "rejected"
  ).length;
  const inProgress = reports.filter(
    (report) => report.status === "in-progress"
  ).length;
  const resolved = reports.filter(
    (report) => report.status === "resolved"
  ).length;
  const critical = reports.filter(
    (report) =>
      report.severity === "critical" && report.status !== "resolved"
  ).length;
  const escalated = reports.filter(
    (report) => (report.escalationLevel ?? 0) > 0
  ).length;

  return (
    <Layout requireRole={["staff", "admin"]} title="My Cases">
      {!organizationId ? (
        <EmptyState
          icon="org"
          title="No Organisation"
          message="You need to belong to an organisation before cases can be assigned."
        />
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-indigo-900 bg-indigo-950/20 p-5">
              <p className="text-sm text-indigo-300">Active Cases</p>
              <p className="mt-2 text-3xl font-bold">{active}</p>
            </div>
            <div className="rounded-2xl border border-yellow-900 bg-yellow-950/20 p-5">
              <p className="text-sm text-yellow-300">In Progress</p>
              <p className="mt-2 text-3xl font-bold">{inProgress}</p>
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
              icon="cases"
              title={
                reports.length === 0
                  ? "No cases assigned"
                  : "No matching cases"
              }
              message={
                reports.length === 0
                  ? "Cases assigned to you will appear here."
                  : "Try adjusting your search criteria or filters."
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                <span>
                  Showing {filtered.length} assigned case
                  {filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
              {filtered.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
