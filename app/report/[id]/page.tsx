"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

type Report = {
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;

  latitude: number;
  longitude: number;

  imageUrl?: string | null;

  createdBy: string;
  createdByEmail?: string | null;

  confirmationCount?: number;
  confirmedBy?: string[];
};

export default function ReportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function loadReport() {
    try {
      setLoading(true);
      setError("");

      const reportRef = doc(db, "reports", reportId);
      const snapshot = await getDoc(reportRef);

      if (!snapshot.exists()) {
        setError("Report not found.");
        setReport(null);
        return;
      }

      setReport(snapshot.data() as Report);
    } catch (err) {
      console.error("Load report error:", err);
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  async function handleConfirm() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!report) {
      return;
    }

    if (report.createdBy === user.uid) {
      setError("You cannot confirm your own report.");
      return;
    }

    if (report.confirmedBy?.includes(user.uid)) {
      setError("You have already confirmed this report.");
      return;
    }

    try {
      setConfirming(true);
      setError("");

      const reportRef = doc(db, "reports", reportId);

      await updateDoc(reportRef, {
        confirmationCount: increment(1),
        confirmedBy: arrayUnion(user.uid),
      });

      await loadReport();
    } catch (err) {
      console.error("Confirm report error:", err);
      setError("Failed to confirm report.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading report...
      </main>
    );
  }

  if (error && !report) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {error}
          </h1>

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!report) {
    return null;
  }

  const alreadyConfirmed =
    user && report.confirmedBy?.includes(user.uid);

  const isOwner =
    user && report.createdBy === user.uid;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.back()}
          className="mb-6 text-gray-400 hover:text-white"
        >
          ← Back
        </button>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          {report.imageUrl && (
            <img
              src={report.imageUrl}
              alt={report.title}
              className="h-80 w-full object-cover"
            />
          )}

          <div className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-300">
                {report.category}
              </span>

              <span className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">
                {report.status}
              </span>

              <span className="rounded-full bg-red-950 px-3 py-1 text-sm text-red-300">
                {report.severity}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-bold">
              {report.title}
            </h1>

            <p className="mt-4 text-lg leading-8 text-gray-300">
              {report.description}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-800 p-5">
                <p className="text-sm text-gray-400">
                  Location
                </p>

                <p className="mt-2 font-medium">
                  {report.latitude.toFixed(6)},{" "}
                  {report.longitude.toFixed(6)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-800 p-5">
                <p className="text-sm text-gray-400">
                  Confirmations
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {report.confirmationCount ?? 0}
                </p>
              </div>
            </div>

            {report.createdByEmail && (
              <div className="mt-6 rounded-xl border border-gray-800 p-5">
                <p className="text-sm text-gray-400">
                  Reported by
                </p>

                <p className="mt-1">
                  {report.createdByEmail}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-400">
                {error}
              </div>
            )}

            <div className="mt-8">
              {isOwner ? (
                <div className="rounded-lg bg-gray-800 p-4 text-gray-300">
                  This is your report.
                </div>
              ) : alreadyConfirmed ? (
                <div className="rounded-lg bg-green-950 p-4 text-green-300">
                  You confirmed this issue.
                </div>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {confirming
                    ? "Confirming..."
                    : "Confirm this issue"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}