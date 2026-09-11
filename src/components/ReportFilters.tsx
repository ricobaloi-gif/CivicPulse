"use client";

import { CATEGORIES, SEVERITIES, STATUSES } from "@/src/lib/constants";
import type { ReactNode } from "react";

interface ReportFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  showDateFilter?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  extraFilters?: ReactNode;
}

const selectClass =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500";

const inputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder:text-gray-500";

export function ReportFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  severity,
  onSeverityChange,
  status,
  onStatusChange,
  showDateFilter = false,
  dateFrom = "",
  dateTo = "",
  onDateFromChange,
  onDateToChange,
  extraFilters,
}: ReportFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search reports..."
          className={`${inputClass} pl-10`}
          aria-label="Search reports"
        />
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value)}
          className={`${selectClass} capitalize`}
          aria-label="Filter by severity"
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
            </option>
          ))}
        </select>

        {extraFilters}
      </div>

      {/* Date range filters */}
      {showDateFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange?.(e.target.value)}
            className={`${selectClass} w-auto`}
            aria-label="Date from"
          />
          <span className="text-xs text-gray-400">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange?.(e.target.value)}
            className={`${selectClass} w-auto`}
            aria-label="Date to"
          />
        </div>
      )}
    </div>
  );
}

export default ReportFilters;
