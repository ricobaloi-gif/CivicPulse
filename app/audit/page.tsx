"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { LoadingState } from "@/src/components/LoadingState";
import { EmptyState } from "@/src/components/EmptyState";
import { formatRelativeTime, formatDateTime, AUDIT_ACTIONS } from "@/src/lib/constants";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";

const PAGE_SIZE = 25;

interface AuditLogEntry {
  id?: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  timestamp?: Timestamp;
  metadata?: Record<string, unknown>;
}

export default function AuditPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = useCallback(
    async (isMore = false) => {
      if (!profile?.organizationId) return;
      try {
        if (isMore) setLoadingMore(true);
        else setLoading(true);

        let q = query(
          collection(db, "auditLogs"),
          where("organizationId", "==", profile.organizationId),
          orderBy("timestamp", "desc"),
          limit(PAGE_SIZE)
        );

        if (isMore && lastDoc) {
          q = query(
            collection(db, "auditLogs"),
            where("organizationId", "==", profile.organizationId),
            orderBy("timestamp", "desc"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
          );
        }

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AuditLogEntry)
        );

        if (isMore) setLogs((p) => [...p, ...items]);
        else setLogs(items);

        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("Audit load error:", err);
        setError("Failed to load audit logs.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [profile?.organizationId, lastDoc]
  );

  useEffect(() => {
    if (profile?.organizationId) loadLogs(false);
    else setLoading(false);
  }, [profile?.organizationId]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (userFilter && !log.performedByName.toLowerCase().includes(userFilter.toLowerCase())) return false;
      if (search) {
        const term = search.toLowerCase();
        const entityMatch = log.entityId.toLowerCase().includes(term);
        const metadataMatch = JSON.stringify(log.metadata).toLowerCase().includes(term);
        if (!entityMatch && !metadataMatch) return false;
      }
      if (dateFrom && log.timestamp) {
        const d = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp as string);
        if (d && d < new Date(dateFrom)) return false;
      }
      if (dateTo && log.timestamp) {
        const d = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp as string);
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        if (d && d > end) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, userFilter, dateFrom, dateTo]);

  const handleReset = () => {
    setSearch("");
    setActionFilter("");
    setUserFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const activeFilterCount =
    (actionFilter ? 1 : 0) + (userFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      status_changed: "Status Changed",
      case_assigned: "Case Assigned",
      case_reassigned: "Case Reassigned",
      assignment_removed: "Assignment Removed",
      report_escalated: "Report Escalated",
      report_resolved: "Report Resolved",
      report_reopened: "Report Reopened",
      dispute_reviewed: "Dispute Reviewed",
      moderation_performed: "Moderation Performed",
      member_added: "Member Added",
      member_removed: "Member Removed",
      invite_created: "Invite Created",
      invite_cancelled: "Invite Cancelled",
      invite_accepted: "Invite Accepted",
      org_settings_changed: "Org Settings Changed",
      report_created: "Report Created",
      trust_score_updated: "Trust Score Updated",
      export_generated: "Export Generated",
      area_created: "Area Created",
      area_updated: "Area Updated",
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    if (action.includes("escalated") || action.includes("reopened")) return "text-orange-400 bg-orange-950/30 border-orange-800";
    if (action.includes("resolved") || action.includes("accepted")) return "text-green-400 bg-green-950/30 border-green-800";
    if (action.includes("rejected") || action.includes("removed") || action.includes("cancelled")) return "text-red-400 bg-red-950/30 border-red-800";
    if (action.includes("assigned") || action.includes("created") || action.includes("added")) return "text-blue-400 bg-blue-950/30 border-blue-800";
    if (action.includes("moderation") || action.includes("dispute")) return "text-purple-400 bg-purple-950/30 border-purple-800";
    if (action.includes("settings") || action.includes("updated")) return "text-yellow-400 bg-yellow-950/30 border-yellow-800";
    return "text-gray-400 bg-gray-800/50 border-gray-700";
  };

  if (loading) {
    return (
      <Layout requireRole={["admin"]} title="Audit Log">
        <LoadingState message="Loading audit logs..." />
      </Layout>
    );
  }

  if (error && !logs.length) {
    return (
      <Layout requireRole={["admin"]} title="Audit Log">
        <EmptyState icon="📋" title="Unable to load audit logs" message={error} />
      </Layout>
    );
  }

  return (
    <Layout requireRole={["admin"]} title="Audit Log">
      {!profile?.organizationId ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">🏢</div>
          <h2 className="mb-2 text-2xl font-bold">No Organisation</h2>
          <p className="mb-6 text-gray-400">
            Set up your organisation to start viewing audit logs.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="page-title">Audit Log</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadLogs(false)}
                disabled={loading}
                className="btn-secondary btn-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by entity ID, metadata..."
                  className="input pl-10"
                  aria-label="Search audit logs"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="select w-48"
                aria-label="Filter by action"
              >
                <option value="">All Actions</option>
                {Object.keys(AUDIT_ACTIONS).sort().map((action) => (
                  <option key={action} value={action}>
                    {getActionLabel(action)}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filter by user name..."
                className="input w-48"
                aria-label="Filter by user"
              />

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input w-40"
                  aria-label="Date from"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input w-40"
                  aria-label="Date to"
                />
              </div>

              {(activeFilterCount > 0 || search) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary btn-sm"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
              {error}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No audit logs found"
              message={
                logs.length === 0
                  ? "No audit logs in your organisation yet."
                  : "Try adjusting your search criteria or filters."
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Showing {filtered.length} log{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/50">
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Timestamp</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Action</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Entity</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Actor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => (
                      <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                          {formatDateTime(log.timestamp as Timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              getActionColor(log.action)
                            }`}
                          >
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          <p className="font-mono text-xs">{log.entityType}</p>
                          <p className="font-mono text-xs text-gray-500 truncate max-w-xs">{log.entityId}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          <p className="font-medium">{log.performedByName}</p>
                          <p className="text-xs text-gray-500 capitalize">{log.performedByRole}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-mono truncate max-w-xs">
                                {JSON.stringify(log.metadata).slice(0, 80)}...
                              </summary>
                              <div className="mt-1 p-2 rounded bg-gray-950 border border-gray-800">
                                <pre className="text-[10px] text-gray-300 whitespace-pre-wrap max-h-32 overflow-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </details>
                          ) : (
                            <span className="text-xs italic">No metadata</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore && !loading && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => loadLogs(true)}
                    disabled={loadingMore}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}