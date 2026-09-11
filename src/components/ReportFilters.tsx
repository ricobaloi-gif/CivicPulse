"use client";

import { useState } from "react";
import { CATEGORIES, SEVERITIES, STATUSES } from "@/src/lib/constants";
import type { ReactNode } from "react";

export interface StaffOption {
  uid: string;
  name?: string;
  email?: string;
}

export interface AreaOption {
  id?: string;
  name: string;
  type?: string;
  code?: string;
  municipality?: string;
}

export interface ReportFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;

  // Assigned staff filter
  assignedStaff?: string;
  onAssignedStaffChange?: (value: string) => void;
  staffList?: StaffOption[];

  // Area / Ward filter
  areaId?: string;
  onAreaIdChange?: (value: string) => void;
  areaList?: AreaOption[];
  ward?: string;
  onWardChange?: (value: string) => void;

  // Municipality filter
  municipality?: string;
  onMunicipalityChange?: (value: string) => void;

  // Date range filters
  showDateFilter?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;

  // Optional reset handler
  onReset?: () => void;
  extraFilters?: ReactNode;
}

const selectClass =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500";

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
  assignedStaff = "",
  onAssignedStaffChange,
  staffList,
  areaId = "",
  onAreaIdChange,
  areaList,
  ward = "",
  onWardChange,
  municipality = "",
  onMunicipalityChange,
  showDateFilter = false,
  dateFrom = "",
  dateTo = "",
  onDateFromChange,
  onDateToChange,
  onReset,
  extraFilters,
}: ReportFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedControls =
    !!onAssignedStaffChange ||
    !!onAreaIdChange ||
    !!onWardChange ||
    !!onMunicipalityChange ||
    showDateFilter;

  const activeFilterCount =
    (category ? 1 : 0) +
    (severity ? 1 : 0) +
    (status ? 1 : 0) +
    (assignedStaff ? 1 : 0) +
    (areaId ? 1 : 0) +
    (ward ? 1 : 0) +
    (municipality ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  function handleResetAll() {
    onSearchChange("");
    onCategoryChange("");
    onSeverityChange("");
    onStatusChange("");
    onAssignedStaffChange?.("");
    onAreaIdChange?.("");
    onWardChange?.("");
    onMunicipalityChange?.("");
    onDateFromChange?.("");
    onDateToChange?.("");
    onReset?.();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      {/* Search bar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by report ID, title, or description..."
            className={`${inputClass} pl-10`}
            aria-label="Search reports"
          />
        </div>

        {hasAdvancedControls && (
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
              showAdvanced || activeFilterCount > 0
                ? "border-blue-700 bg-blue-950/40 text-blue-300"
                : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-750"
            }`}
          >
            <span>⚙️ Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {(activeFilterCount > 0 || search) && (
          <button
            type="button"
            onClick={handleResetAll}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Primary filters */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Advanced filters dropdown area */}
      {(showAdvanced || activeFilterCount > 3) && hasAdvancedControls && (
        <div className="mt-3 grid gap-3 border-t border-gray-800/80 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Assigned Staff Filter */}
          {onAssignedStaffChange && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Assigned Staff
              </label>
              <select
                value={assignedStaff}
                onChange={(e) => onAssignedStaffChange(e.target.value)}
                className={`w-full ${selectClass}`}
                aria-label="Filter by assigned staff"
              >
                <option value="">All Staff / Unassigned</option>
                <option value="unassigned">Unassigned Only</option>
                {staffList?.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.name || s.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Area / Ward Filter */}
          {onAreaIdChange && areaList && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Service Area / Ward
              </label>
              <select
                value={areaId}
                onChange={(e) => onAreaIdChange(e.target.value)}
                className={`w-full ${selectClass}`}
                aria-label="Filter by service area"
              >
                <option value="">All Service Areas</option>
                {areaList.map((a) => (
                  <option key={a.id || a.name} value={a.id || a.name}>
                    {a.name} {a.code ? `(${a.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ward Manual / Code filter */}
          {onWardChange && !areaList && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Ward
              </label>
              <input
                type="text"
                value={ward}
                onChange={(e) => onWardChange(e.target.value)}
                placeholder="Filter by ward (e.g. Ward 4)"
                className={`w-full ${selectClass}`}
                aria-label="Filter by ward"
              />
            </div>
          )}

          {/* Municipality Filter */}
          {onMunicipalityChange && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Municipality
              </label>
              <input
                type="text"
                value={municipality}
                onChange={(e) => onMunicipalityChange(e.target.value)}
                placeholder="e.g. Johannesburg"
                className={`w-full ${selectClass}`}
                aria-label="Filter by municipality"
              />
            </div>
          )}

          {/* Date range filters */}
          {showDateFilter && (
            <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  className={`w-full ${selectClass}`}
                  aria-label="Date from"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  className={`w-full ${selectClass}`}
                  aria-label="Date to"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportFilters;
