"use client";

import { useState } from "react";
import { CATEGORIES, SEVERITIES, STATUSES } from "@/src/lib/constants";
import type { ReactNode } from "react";
import { Filter, X, SlidersHorizontal } from "lucide-react";

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

  assignedStaff?: string;
  onAssignedStaffChange?: (value: string) => void;
  staffList?: StaffOption[];

  areaId?: string;
  onAreaIdChange?: (value: string) => void;
  areaList?: AreaOption[];
  ward?: string;
  onWardChange?: (value: string) => void;

  municipality?: string;
  onMunicipalityChange?: (value: string) => void;

  showDateFilter?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;

  onReset?: () => void;
  extraFilters?: ReactNode;
}

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
    <div className="card">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by report ID, title, or description..."
            className="input pl-10"
            aria-label="Search reports"
          />
        </div>

        {hasAdvancedControls && (
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
              showAdvanced || activeFilterCount > 0
                ? "border-primary/30 bg-primary-muted text-primary"
                : "border-border bg-surface-elevated text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {(activeFilterCount > 0 || search) && (
          <button
            type="button"
            onClick={handleResetAll}
            className="btn-secondary btn-sm"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="select"
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
          className="select capitalize"
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
          className="select"
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

      {(showAdvanced || activeFilterCount > 3) && hasAdvancedControls && (
        <div className="mt-3 grid gap-3 border-t border-border/80 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {onAssignedStaffChange && (
            <div>
              <label className="label">Assigned Staff</label>
              <select
                value={assignedStaff}
                onChange={(e) => onAssignedStaffChange(e.target.value)}
                className="select"
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

          {onAreaIdChange && areaList && (
            <div>
              <label className="label">Service Area / Ward</label>
              <select
                value={areaId}
                onChange={(e) => onAreaIdChange(e.target.value)}
                className="select"
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

          {onWardChange && !areaList && (
            <div>
              <label className="label">Ward</label>
              <input
                type="text"
                value={ward}
                onChange={(e) => onWardChange(e.target.value)}
                placeholder="Filter by ward (e.g. Ward 4)"
                className="input"
                aria-label="Filter by ward"
              />
            </div>
          )}

          {onMunicipalityChange && (
            <div>
              <label className="label">Municipality</label>
              <input
                type="text"
                value={municipality}
                onChange={(e) => onMunicipalityChange(e.target.value)}
                placeholder="e.g. Johannesburg"
                className="input"
                aria-label="Filter by municipality"
              />
            </div>
          )}

          {showDateFilter && (
            <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="label">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  className="input"
                  aria-label="Date from"
                />
              </div>
              <div className="flex-1">
                <label className="label">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  className="input"
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