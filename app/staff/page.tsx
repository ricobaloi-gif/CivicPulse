"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { ReportFilters } from "@/src/components/ReportFilters";
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
  escalationLevel?: number;
  createdAt?: { toDate(): Date } | null;
}

export default function StaffPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<StaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user || !profile?.organizationId) {
      setLoading(false);
      return;
    }

    async function fetchCases() {
      try {
        setLoading(true);
        const q = query(
          collection(db, "reports"),
          where("organizationId", "==", profile!.organizationId)
        );
        const snapshot = await getDocs(q);
        const all = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as StaffReport))
          .filter((r) => r.assignedTo === user!.uid)
          .sort((a, b) => {
            const da = a.createdAt && "toDate" in a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const db2 = b.createdAt && "toDate" in b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return db2 - da;
          });
        setReports(all);
      } catch (err) {
        console.error("Staff fetch error:", err);
        setError("Unable to load your assigned cases.");
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, [user, profile]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (category && r.category !== category) return false;
      if (severity && r.severity !== severity) return false;
      if (status && r.status !== status) return false;
      if (search) {
        const term = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(term) && !r.description?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [reports, search, category, severity, status]);

  const active = reports.filter((r) => r.status !== "resolved" && r.status !== "rejected").length;
  const inProgress = reports.filter((r) => r.status === "in-progress").length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  const critical = reports.filter((r) => r.severity === "critical" && r.status !== "resolved").length;

  return (
    <Layout requireRole={["staff", "admin"]} title="My Cases">
      {!profile?.organizationId ? (
        <EmptyState icon="🏢" title="No Organisation" message="You need to belong to an organisation before cases can be assigned." />
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          </section>

          <div className="mb-6">
            <ReportFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} severity={severity} onSeverityChange={setSeverity} status={status} onStatusChange={setStatus} />
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>}

          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="🗂️" title={reports.length === 0 ? "No cases assigned" : "No matching cases"} message={reports.length === 0 ? "Cases assigned to you will appear here." : "Try adjusting your filters."} />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}