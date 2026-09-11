"use client";

import Link from "next/link";
import { CATEGORY_EMOJI } from "@/src/lib/constants";
import { formatRelativeTime } from "@/src/lib/constants";
import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";

interface ReportCardReport {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  confirmationCount?: number;
  assignedToName?: string | null;
  organizationName?: string | null;
  escalationLevel?: number;
  createdAt?: { toDate(): Date } | Date | null;
}

interface ReportCardProps {
  report: ReportCardReport;
  showOrg?: boolean;
}

export function ReportCard({ report, showOrg = false }: ReportCardProps) {
  const emoji = CATEGORY_EMOJI[report.category ?? ""] ?? "📍";

  return (
    <Link
      href={`/report/${report.id}`}
      className="block rounded-2xl border border-gray-800 bg-gray-900 p-5 transition hover:border-gray-600"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-white">
            {report.title || "Untitled Report"}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2">
            {report.status && <StatusBadge status={report.status} />}
            {report.severity && <SeverityBadge severity={report.severity} />}
            {(report.escalationLevel ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-800 bg-red-950/50 px-2.5 py-0.5 text-xs font-medium text-red-300">
                🔺 L{report.escalationLevel}
              </span>
            )}
          </div>

          {report.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">
              {report.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {(report.confirmationCount ?? 0) > 0 && (
              <span>
                👍 {report.confirmationCount} confirmation{(report.confirmationCount ?? 0) !== 1 ? "s" : ""}
              </span>
            )}
            {report.assignedToName && (
              <span>👤 {report.assignedToName}</span>
            )}
            {showOrg && report.organizationName && (
              <span>🏢 {report.organizationName}</span>
            )}
            {report.createdAt && (
              <span>{formatRelativeTime(report.createdAt as { toDate(): Date })}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default ReportCard;
