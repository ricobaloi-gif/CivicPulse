"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

type Report = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  imageUrl?: string | null;
  confirmationCount?: number;
};

export default function MyReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      if (!user) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const reportsQuery = query(
          collection(db, "reports"),
          where("createdBy", "==", user.uid)
        );

        const snapshot = await getDocs(reportsQuery);

        const loadedReports: Report[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Report, "id">),
        }));

        setReports(loadedReports);
      } catch (err) {
        console.error("My reports error:", err);
        setError("Failed to load your reports.");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        loadReports();
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading your reports...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              My Reports
            </h1>

            <p className="mt-2 text-gray-400">
              Track the issues you have reported.
            </p>
          </div>

          <button
            onClick={() => router.push("/report/new")}
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
          >
            New Report
          </button>
        </div>
    <div className="mt-8 flex flex-wrap gap-4">
  <button
    onClick={() => router.push("/report/new")}
    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
  >
    Report an Issue
  </button>

  <button
    onClick={() => router.push("/reports")}
    className="rounded-lg border border-gray-700 px-5 py-3 font-semibold hover:bg-gray-800"
  >
    Browse Reports
  </button>

  <button
    onClick={() => router.push("/my-reports")}
    className="rounded-lg border border-gray-700 px-5 py-3 font-semibold hover:bg-gray-800"
  >
    My Reports
  </button>
</div>
        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-400">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <h2 className="text-2xl font-semibold">
              You haven't reported anything yet
            </h2>

            <p className="mt-2 text-gray-400">
              When you submit an issue, it will appear here.
            </p>

            <button
              onClick={() => router.push("/report/new")}
              className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              Report Your First Issue
            </button>
          </div>
          
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() =>
                  router.push(`/report/${report.id}`)
                }
                className="flex w-full flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-gray-700 md:flex-row"
              >
                {report.imageUrl && (
                  <img
                    src={report.imageUrl}
                    alt={report.title}
                    className="h-32 w-full rounded-xl object-cover md:w-44"
                  />
                )}

                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
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

                  <h2 className="mt-3 text-xl font-bold">
                    {report.title}
                  </h2>

                  <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                    {report.description}
                  </p>

                  <p className="mt-4 text-sm text-gray-500">
                    {report.confirmationCount ?? 0} confirmations
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}