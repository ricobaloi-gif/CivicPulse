"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

type Report = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  imageUrl?: string | null;
  confirmationCount?: number;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
};

export default function BrowseReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const reportsQuery = query(
        collection(db, "reports"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(reportsQuery);

      const loadedReports: Report[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Report, "id">),
      }));

      setReports(loadedReports);
    } catch (err) {
      console.error("Load reports error:", err);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesCategory =
        categoryFilter === "all" ||
        report.category === categoryFilter;

      const matchesSeverity =
        severityFilter === "all" ||
        report.severity === severityFilter;

      const matchesStatus =
        statusFilter === "all" ||
        report.status === statusFilter;

      const searchText = search.toLowerCase();

      const matchesSearch =
        report.title.toLowerCase().includes(searchText) ||
        report.description.toLowerCase().includes(searchText) ||
        report.category.toLowerCase().includes(searchText);

      return (
        matchesCategory &&
        matchesSeverity &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    reports,
    categoryFilter,
    severityFilter,
    statusFilter,
    search,
  ]);

  function formatDate(report: Report) {
    if (!report.createdAt?.seconds) {
      return "Unknown date";
    }

    return new Date(
      report.createdAt.seconds * 1000
    ).toLocaleString();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading reports...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              Browse Reports
            </h1>

            <p className="mt-2 text-gray-400">
              Explore civic issues reported by the community.
            </p>
          </div>

          <button
            onClick={() => router.push("/report/new")}
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
          >
            Report an Issue
          </button>
        </div>

        <div className="mb-8 grid gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 md:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3"
          >
            <option value="all">All categories</option>
            <option value="Pothole">Pothole</option>
            <option value="Water Leak">Water Leak</option>
            <option value="Power Outage">Power Outage</option>
            <option value="Broken Streetlight">
              Broken Streetlight
            </option>
            <option value="Illegal Dumping">
              Illegal Dumping
            </option>
            <option value="Road Hazard">
              Road Hazard
            </option>
            <option value="Sewer Issue">
              Sewer Issue
            </option>
            <option value="Vandalism">
              Vandalism
            </option>
            <option value="Other">Other</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3"
          >
            <option value="all">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3"
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="acknowledged">
              Acknowledged
            </option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">
              In Progress
            </option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-400">
            {error}
          </div>
        )}

        <p className="mb-5 text-sm text-gray-400">
          {filteredReports.length} report
          {filteredReports.length === 1 ? "" : "s"} found
        </p>

        {filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <h2 className="text-2xl font-semibold">
              No reports found
            </h2>

            <p className="mt-2 text-gray-400">
              Try changing your filters or create a new report.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() =>
                  router.push(`/report/${report.id}`)
                }
                className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 text-left transition hover:-translate-y-1 hover:border-gray-700"
              >
                {report.imageUrl ? (
                  <img
                    src={report.imageUrl}
                    alt={report.title}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-gray-800 text-gray-500">
                    No photo
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">
                      {report.category}
                    </span>

                    <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                      {report.status}
                    </span>

                    <span className="rounded-full bg-red-950 px-3 py-1 text-xs text-red-300">
                      {report.severity}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold">
                    {report.title}
                  </h2>

                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">
                    {report.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {report.confirmationCount ?? 0} confirmations
                    </span>

                    <span>{formatDate(report)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}