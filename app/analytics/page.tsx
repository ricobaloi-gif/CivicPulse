"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { formatRelativeTime, formatDateTime, CATEGORIES, SEVERITIES, STATUSES } from "@/src/lib/constants";
import { Layout } from "@/src/components/Layout";
import { LoadingState } from "@/src/components/LoadingState";
import { EmptyState } from "@/src/components/EmptyState";
import {
  FileText,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Clock,
  Users,
  MapPin,
  AlertTriangle,
  Target,
} from "lucide-react";

interface AnalyticsData {
  totalReports: number;
  openReports: number;
  resolvedReports: number;
  criticalReports: number;
  escalatedReports: number;
  statusBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
  averageAcknowledgementTimeHours: number;
  averageResolutionTimeHours: number;
  staffWorkload: Array<{ name: string; assigned: number; inProgress: number; resolved: number }>;
  slaBreachCount: number;
  overdueCount: number;
  monthlyTrend: Array<{ month: string; created: number; resolved: number }>;
}

const COLORS = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f97316",
  danger: "#ef4444",
  info: "#06b6d4",
  purple: "#a855f7",
  pink: "#ec4899",
  amber: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "#3b82f6",
  acknowledged: "#0ea5e9",
  assigned: "#6366f1",
  "in-progress": "#a855f7",
  resolved: "#22c55e",
  verified: "#10b981",
  reopened: "#f97316",
  rejected: "#ef4444",
  duplicate: "#6b7280",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const CATEGORY_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#f97316",
  "#fbbf24",
  "#ef4444",
  "#f97316",
  "#84cc16",
  "#a855f7",
  "#ec4899",
];

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {trend && <p className="mt-1 text-xs text-green-400">{trend}</p>}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-xs text-gray-400">{description}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-lg">
        <p className="text-xs font-semibold text-gray-300">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (dateRange.from) params.set("dateFrom", dateRange.from);
        if (dateRange.to) params.set("dateTo", dateRange.to);

        const response = await fetch(`/api/analytics?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("apiKey") || ""}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Invalid response");
        }
      } catch (err) {
        console.error("Analytics fetch error:", err);
        setError("Unable to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (loading) {
    return (
      <Layout requireRole={["admin"]} title="Analytics">
        <LoadingState message="Loading analytics..." />
      </Layout>
    );
  }

  if (error && !data) {
    return (
      <Layout requireRole={["admin"]} title="Analytics">
        <EmptyState icon="📊" title="Unable to load analytics" message={error} />
      </Layout>
    );
  }

  if (!data) return null;

  const statusChartData = useMemo(() =>
    Object.entries(data.statusBreakdown)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace("-", " "),
        value,
        color: STATUS_COLORS[name] || "#6b7280",
      }))
  , [data.statusBreakdown]);

  const severityChartData = useMemo(() =>
    Object.entries(data.severityBreakdown)
      .filter(([, v]) => v > 0)
      .map(([name, value], index) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: SEVERITY_COLORS[name] || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
  , [data.severityBreakdown]);

  const categoryChartData = useMemo(() =>
    Object.entries(data.categoryBreakdown)
      .filter(([, v]) => v > 0)
      .map(([name, value], index) => ({
        name,
        value,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
  , [data.categoryBreakdown]);

  const areaChartData = useMemo(() =>
    Object.entries(data.areaBreakdown)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  , [data.areaBreakdown]);

  const monthlyTrendData = useMemo(() => data.monthlyTrend, [data.monthlyTrend]);

  return (
    <Layout requireRole={["admin"]} title="Analytics">
      <div className="space-y-6">
        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="page-title">Organisation Analytics</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">From:</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
                className="input w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">To:</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
                className="input w-40"
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KPICard
            title="Total Reports"
            value={formatNumber(data.totalReports)}
            icon={FileText}
            color={COLORS.primary}
          />
          <KPICard
            title="Open Reports"
            value={formatNumber(data.openReports)}
            icon={AlertCircle}
            color={COLORS.warning}
          />
          <KPICard
            title="Resolved"
            value={formatNumber(data.resolvedReports)}
            icon={CheckCircle}
            color={COLORS.success}
          />
          <KPICard
            title="Critical Open"
            value={formatNumber(data.criticalReports)}
            icon={AlertTriangle}
            color={COLORS.danger}
          />
          <KPICard
            title="Escalated"
            value={formatNumber(data.escalatedReports)}
            icon={TrendingUp}
            color={COLORS.purple}
          />
          <KPICard
            title="SLA Breaches"
            value={formatNumber(data.slaBreachCount)}
            icon={Target}
            color={COLORS.pink}
          />
        </section>

        {/* Time Metrics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Avg Acknowledgement Time"
            value={formatHours(data.averageAcknowledgementTimeHours)}
            icon={Clock}
            color={COLORS.info}
          />
          <KPICard
            title="Avg Resolution Time"
            value={formatHours(data.averageResolutionTimeHours)}
            icon={Clock}
            color={COLORS.success}
          />
          <KPICard
            title="Overdue Cases"
            value={formatNumber(data.overdueCount)}
            icon={AlertTriangle}
            color={COLORS.danger}
          />
          <KPICard
            title="Active Staff"
            value={data.staffWorkload.filter((s) => s.assigned > 0).length}
            icon={Users}
            color={COLORS.purple}
          />
        </section>

        {/* Charts Row 1 */}
        <section className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Reports by Status"
            description="Current distribution of report statuses"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  labelLine={false}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Reports by Severity"
            description="Severity distribution across all reports"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  labelLine={false}
                >
                  {severityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Charts Row 2 */}
        <section className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Reports by Category"
            description="Category breakdown of all reports"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Reports by Area / Ward"
            description="Top 10 areas by report volume"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={COLORS.primary} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Monthly Trend */}
        <section>
          <ChartCard
            title="Monthly Trend"
            description="Reports created vs resolved over time"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke={COLORS.success}
                  strokeWidth={2}
                  dot={{ fill: COLORS.success, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Staff Workload */}
        {data.staffWorkload.length > 0 && (
          <section>
            <ChartCard
              title="Staff Workload"
              description="Cases assigned, in progress, and resolved per staff member"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-3 font-medium text-gray-400">Staff Member</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-400">Assigned</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-400">In Progress</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-400">Resolved</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-400">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffWorkload.map((staff) => (
                      <tr key={staff.name} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3 font-medium">{staff.name}</td>
                        <td className="text-right py-2 px-3 text-blue-400">{staff.assigned}</td>
                        <td className="text-right py-2 px-3 text-yellow-400">{staff.inProgress}</td>
                        <td className="text-right py-2 px-3 text-green-400">{staff.resolved}</td>
                        <td className="text-right py-2 px-3 font-semibold">
                          {staff.assigned + staff.inProgress + staff.resolved}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </section>
        )}

        {/* SLA Indicators */}
        {(data.slaBreachCount > 0 || data.overdueCount > 0) && (
          <section>
            <div className="rounded-2xl border border-orange-800 bg-orange-950/30 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-300">SLA Alerts</h3>
                  <p className="mt-1 text-sm text-orange-400">
                    {data.slaBreachCount > 0 && (
                      <span className="mr-4">
                        <strong>{data.slaBreachCount}</strong> SLA breach{data.slaBreachCount !== 1 ? "es" : ""} detected
                      </span>
                    )}
                    {data.overdueCount > 0 && (
                      <span>
                        <strong>{data.overdueCount}</strong> overdue case{data.overdueCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Review organisation SLA targets in Settings. Consider escalating overdue cases.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}