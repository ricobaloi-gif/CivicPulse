"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { EmptyState } from "@/src/components/EmptyState";
import { AREA_TYPES, formatRelativeTime } from "@/src/lib/constants";
import {
  createArea,
  updateArea,
  toggleAreaStatus,
} from "@/src/lib/areas";
import type { Area, AreaType, UserProfile } from "@/src/lib/types";

export default function OrganizationAreasPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [areas, setAreas] = useState<Area[]>([]);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AreaType>("ward");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMunicipality, setFormMunicipality] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formStaff, setFormStaff] = useState<string[]>([]);

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const loadData = useCallback(async () => {
    const currentProfile = profileRef.current;
    if (!currentProfile?.organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const orgId = currentProfile.organizationId;

      // 1. Fetch areas scoped to organization
      const areasQuery = query(
        collection(db, "areas"),
        where("organizationId", "==", orgId)
      );
      const areasSnap = await getDocs(areasQuery);
      const areaItems = areasSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Area[];

      areaItems.sort((a, b) => a.name.localeCompare(b.name));
      setAreas(areaItems);

      // 2. Fetch staff members of organization
      const staffQuery = query(
        collection(db, "users"),
        where("organizationId", "==", orgId)
      );
      const staffSnap = await getDocs(staffQuery);
      const members = staffSnap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.role === "staff" || u.role === "admin");

      setStaffList(members);
    } catch (err) {
      console.error("Load areas error:", err);
      setError("Unable to load service areas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const currentProfile = profileRef.current;
    if (!currentProfile?.organizationId) {
      setLoading(false);
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [profile?.organizationId, loadData]);

  function openCreateModal() {
    setEditingArea(null);
    setFormName("");
    setFormType("ward");
    setFormCode("");
    setFormDescription("");
    setFormMunicipality("");
    setFormProvince("");
    setFormStaff([]);
    setError("");
    setIsFormOpen(true);
  }

  function openEditModal(area: Area) {
    setEditingArea(area);
    setFormName(area.name);
    setFormType(area.type);
    setFormCode(area.code || "");
    setFormDescription(area.description || "");
    setFormMunicipality(area.municipality || "");
    setFormProvince(area.province || "");
    setFormStaff(area.assignedStaff || []);
    setError("");
    setIsFormOpen(true);
  }

  function toggleStaffSelection(uid: string) {
    setFormStaff((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile?.organizationId) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setError("Area name is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const userName = profile.name?.trim() || user.email || "Admin";

      if (editingArea?.id) {
        // Update existing area
        await updateArea(
          editingArea.id,
          profile.organizationId,
          {
            name: trimmedName,
            type: formType,
            code: formCode,
            description: formDescription,
            municipality: formMunicipality,
            province: formProvince,
            assignedStaff: formStaff,
          },
          user.uid,
          userName,
          profile.role || "admin"
        );
        setSuccess(`Area "${trimmedName}" updated successfully.`);
      } else {
        // Create new area
        await createArea({
          organizationId: profile.organizationId,
          name: trimmedName,
          type: formType,
          code: formCode,
          description: formDescription,
          municipality: formMunicipality,
          province: formProvince,
          assignedStaff: formStaff,
          createdBy: user.uid,
          createdByName: userName,
          createdByRole: profile.role || "admin",
        });
        setSuccess(`Area "${trimmedName}" created successfully.`);
      }

      setIsFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      console.error("Area save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save area.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(area: Area) {
    if (!user || !profile?.organizationId || !area.id) return;

    try {
      setTogglingId(area.id);
      setError("");
      setSuccess("");

      const newStatus = !area.active;
      await toggleAreaStatus(
        area.id,
        profile.organizationId,
        newStatus,
        user.uid,
        profile.name || user.email || "Admin",
        profile.role || "admin"
      );

      setSuccess(`Area "${area.name}" is now ${newStatus ? "active" : "disabled"}.`);
      await loadData();
    } catch (err: unknown) {
      console.error("Toggle area error:", err);
      setError(err instanceof Error ? err.message : "Failed to update area status.");
    } finally {
      setTogglingId(null);
    }
  }

  // Filtered areas
  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      if (typeFilter && area.type !== typeFilter) return false;
      if (statusFilter === "active" && !area.active) return false;
      if (statusFilter === "disabled" && area.active) return false;

      if (search.trim()) {
        const s = search.toLowerCase().trim();
        const nameMatch = area.name.toLowerCase().includes(s);
        const codeMatch = area.code?.toLowerCase().includes(s);
        const muniMatch = area.municipality?.toLowerCase().includes(s);
        if (!nameMatch && !codeMatch && !muniMatch) return false;
      }

      return true;
    });
  }, [areas, search, typeFilter, statusFilter]);

  const totalCount = areas.length;
  const activeCount = areas.filter((a) => a.active).length;
  const wardCount = areas.filter((a) => a.type === "ward").length;

  if (!profile?.organizationId) {
    return (
      <Layout requireRole={["admin"]} title="Service Areas">
        <EmptyState
          icon="🏢"
          title="No Organisation"
          message="Create an organisation first before setting up wards and service areas."
        />
      </Layout>
    );
  }

  return (
    <Layout requireRole={["admin"]} title="Service Areas & Wards">
      <div className="mx-auto max-w-6xl">
        {/* Navigation bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Operations
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
          >
            + New Service Area / Ward
          </button>
        </div>

        {/* Header & Stats */}
        <header className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Geographic Coverage
          </p>
          <h1 className="mt-2 text-3xl font-bold">Wards &amp; Service Areas</h1>
          <p className="mt-2 text-gray-400">
            Organise reports, allocate staff members to specific wards or zones, and track municipal jurisdiction.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <p className="text-xs text-gray-400">Total Areas</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-green-900/40 bg-green-950/20 p-4">
              <p className="text-xs text-green-300">Active Areas</p>
              <p className="mt-1 text-2xl font-bold text-green-300">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4">
              <p className="text-xs text-blue-300">Wards</p>
              <p className="mt-1 text-2xl font-bold text-blue-300">{wardCount}</p>
            </div>
            <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4">
              <p className="text-xs text-indigo-300">Available Staff</p>
              <p className="mt-1 text-2xl font-bold text-indigo-300">{staffList.length}</p>
            </div>
          </div>
        </header>

        {/* Alerts */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-green-900 bg-green-950/30 p-4 text-green-300">
            {success}
          </div>
        )}

        {/* Filters */}
        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search areas by name, code or municipality..."
            className="w-full sm:w-80 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />

          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500"
            >
              <option value="">All Types</option>
              {AREA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "disabled")}
              className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
        </section>

        {/* Areas List */}
        <section className="mt-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
            </div>
          ) : filteredAreas.length === 0 ? (
            <EmptyState
              icon="📍"
              title="No service areas found"
              message={
                areas.length === 0
                  ? "Define your wards, suburbs or municipal zones to organize case dispatch."
                  : "No areas match your search filters."
              }
            />
          ) : (
            filteredAreas.map((area) => {
              const assignedMembers = staffList.filter((s) =>
                area.assignedStaff?.includes(s.uid)
              );

              return (
                <div
                  key={area.id}
                  className={`rounded-2xl border p-6 transition ${
                    area.active
                      ? "border-gray-800 bg-gray-900"
                      : "border-gray-800/60 bg-gray-900/40 opacity-75"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-white">{area.name}</h3>

                        <span className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300 capitalize">
                          {area.type}
                        </span>

                        {area.code && (
                          <span className="rounded-full border border-blue-900 bg-blue-950/40 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                            {area.code}
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            area.active
                              ? "border-green-800 bg-green-950/40 text-green-300"
                              : "border-gray-700 bg-gray-800 text-gray-400"
                          }`}
                        >
                          {area.active ? "Active" : "Disabled"}
                        </span>
                      </div>

                      {area.description && (
                        <p className="mt-2 text-sm text-gray-400">{area.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                        {area.municipality && (
                          <span>🏛️ Municipality: {area.municipality}</span>
                        )}
                        {area.province && <span>📍 Province: {area.province}</span>}
                        {area.createdAt && (
                          <span>📅 Created {formatRelativeTime(area.createdAt)}</span>
                        )}
                      </div>

                      {/* Assigned staff list */}
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Assigned Staff ({assignedMembers.length})
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {assignedMembers.length === 0 ? (
                            <span className="text-xs text-gray-500">
                              No staff assigned yet.
                            </span>
                          ) : (
                            assignedMembers.map((m) => (
                              <span
                                key={m.uid}
                                className="inline-flex items-center gap-1 rounded-full border border-indigo-800/80 bg-indigo-950/40 px-2.5 py-1 text-xs text-indigo-200"
                              >
                                👤 {m.name || m.email}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2 sm:self-start">
                      <button
                        type="button"
                        onClick={() => openEditModal(area)}
                        className="rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(area)}
                        disabled={togglingId === area.id}
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          area.active
                            ? "border-amber-900 bg-amber-950/30 text-amber-300 hover:bg-amber-950"
                            : "border-green-900 bg-green-950/30 text-green-300 hover:bg-green-950"
                        }`}
                      >
                        {togglingId === area.id
                          ? "Saving..."
                          : area.active
                          ? "Disable"
                          : "Enable"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Create / Edit Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingArea ? "Edit Service Area" : "Create New Service Area"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Area Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="e.g. Ward 34 or Rosebank Central"
                    className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Area Type *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AreaType)}
                      className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    >
                      {AREA_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Area Code / Identifier
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g. W34, SUB-09"
                      className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Municipality
                    </label>
                    <input
                      type="text"
                      value={formMunicipality}
                      onChange={(e) => setFormMunicipality(e.target.value)}
                      placeholder="e.g. City of Johannesburg"
                      className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Province
                    </label>
                    <input
                      type="text"
                      value={formProvince}
                      onChange={(e) => setFormProvince(e.target.value)}
                      placeholder="e.g. Gauteng"
                      className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    placeholder="Brief description of geographic boundaries or scope..."
                    className="mt-1 w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                {/* Staff Assignment */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Assign Staff Members ({formStaff.length} selected)
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Staff assigned here will be responsible for cases occurring in this area.
                  </p>

                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 rounded-xl border border-gray-800 bg-gray-950 p-3">
                    {staffList.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        No staff members found in this organisation.
                      </p>
                    ) : (
                      staffList.map((s) => {
                        const isSelected = formStaff.includes(s.uid);
                        return (
                          <label
                            key={s.uid}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-gray-200 hover:bg-gray-900 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStaffSelection(s.uid)}
                              className="rounded border-gray-700"
                            />
                            <span>{s.name || s.email}</span>
                            <span className="text-gray-500">({s.role})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingArea ? "Update Area" : "Create Area"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
