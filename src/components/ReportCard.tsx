"use client";

import Link from "next/link";
import { CATEGORY_EMOJI } from "@/src/lib/constants";
import { formatRelativeTime } from "@/src/lib/constants";
import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";
import { MapPin, User, Building2, Clock, CheckCircle } from "lucide-react";

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
  areaName?: string | null;
  ward?: string | null;
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
      className="card-interactive"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-xl" aria-hidden="true">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {report.title || "Untitled Report"}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2">
            {report.status && <StatusBadge status={report.status} />}
            {report.severity && <SeverityBadge severity={report.severity} />}
            {(report.escalationLevel ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-muted px-2.5 py-0.5 text-xs font-medium text-danger">
                L{report.escalationLevel}
              </span>
            )}
          </div>

          {report.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {report.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(report.confirmationCount ?? 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                {report.confirmationCount} confirmation{(report.confirmationCount ?? 0) !== 1 ? "s" : ""}
              </span>
            )}
            {report.assignedToName && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {report.assignedToName}
              </span>
            )}
            {showOrg && report.organizationName && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {report.organizationName}
              </span>
            )}
            {(report.areaName || report.ward) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {report.areaName || report.ward}
              </span>
            )}
            {report.createdAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatRelativeTime(report.createdAt as { toDate(): Date })}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default ReportCard;