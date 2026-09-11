"use client";

import { STATUS_CONFIG, formatDateTime } from "@/src/lib/constants";
import type { StatusHistoryEntry } from "@/src/lib/types";

interface CaseTimelineProps {
  history: StatusHistoryEntry[];
}

export function CaseTimeline({ history }: CaseTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-gray-500">No status history available.</p>
    );
  }

  // Show most recent first
  const sorted = [...history].sort((a, b) => {
    const dateA = a.changedAt
      ? a.changedAt instanceof Date
        ? a.changedAt.getTime()
        : (a.changedAt as { toDate(): Date }).toDate().getTime()
      : 0;
    const dateB = b.changedAt
      ? b.changedAt instanceof Date
        ? b.changedAt.getTime()
        : (b.changedAt as { toDate(): Date }).toDate().getTime()
      : 0;
    return dateB - dateA;
  });

  return (
    <div className="relative space-y-0">
      {sorted.map((entry, index) => {
        const config = STATUS_CONFIG[entry.status] ?? {
          icon: "📋",
          label: entry.status,
          text: "text-gray-300",
        };

        const isLast = index === sorted.length - 1;

        return (
          <div key={index} className="relative flex gap-4 pb-6">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 h-full w-px bg-gray-800" />
            )}

            {/* Icon circle */}
            <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-base">
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <p className={`font-semibold ${config.text}`}>
                {config.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatDateTime(entry.changedAt as { toDate(): Date })}
                {entry.changedByName && (
                  <> · {entry.changedByName}</>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CaseTimeline;
