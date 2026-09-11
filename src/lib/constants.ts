/**
 * Centralized constants for CivicPulse.
 * Categories, severities, statuses, emoji mappings, and color schemes.
 */

import type { ReportCategory, ReportSeverity, ReportStatus, AreaType, OrganizationType } from "./types";

// ─── Report Categories ──────────────────────────────────

export const CATEGORIES: ReportCategory[] = [
  "Pothole",
  "Water Leak",
  "Power Outage",
  "Broken Streetlight",
  "Illegal Dumping",
  "Road Hazard",
  "Sewer Issue",
  "Vandalism",
  "Other",
];

// ─── Category Emoji Map ─────────────────────────────────

export const CATEGORY_EMOJI: Record<string, string> = {
  Pothole: "🕳️",
  "Water Leak": "💧",
  "Power Outage": "⚡",
  "Broken Streetlight": "💡",
  "Illegal Dumping": "⚠️",
  "Road Hazard": "🚧",
  "Sewer Issue": "☣️",
  Vandalism: "🧱",
  Other: "📍",
};

// ─── Severities ─────────────────────────────────────────

export const SEVERITIES: ReportSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

// ─── Severity Color Map ─────────────────────────────────

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; marker: string }> = {
  critical: {
    bg: "bg-red-950/50",
    text: "text-red-300",
    border: "border-red-800",
    marker: "#ef4444",
  },
  high: {
    bg: "bg-orange-950/50",
    text: "text-orange-300",
    border: "border-orange-800",
    marker: "#f97316",
  },
  medium: {
    bg: "bg-yellow-950/50",
    text: "text-yellow-300",
    border: "border-yellow-800",
    marker: "#eab308",
  },
  low: {
    bg: "bg-green-950/50",
    text: "text-green-300",
    border: "border-green-800",
    marker: "#22c55e",
  },
};

// ─── Report Statuses ────────────────────────────────────

export const STATUSES: ReportStatus[] = [
  "submitted",
  "acknowledged",
  "assigned",
  "in-progress",
  "resolved",
  "reopened",
  "verified",
  "rejected",
  "duplicate",
];

// ─── Status Display Configuration ───────────────────────

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  submitted: {
    label: "Submitted",
    bg: "bg-blue-950/50",
    text: "text-blue-300",
    border: "border-blue-800",
    icon: "📥",
  },
  acknowledged: {
    label: "Acknowledged",
    bg: "bg-sky-950/50",
    text: "text-sky-300",
    border: "border-sky-800",
    icon: "👁️",
  },
  assigned: {
    label: "Assigned",
    bg: "bg-indigo-950/50",
    text: "text-indigo-300",
    border: "border-indigo-800",
    icon: "👤",
  },
  "in-progress": {
    label: "In Progress",
    bg: "bg-purple-950/50",
    text: "text-purple-300",
    border: "border-purple-800",
    icon: "🔧",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-green-950/50",
    text: "text-green-300",
    border: "border-green-800",
    icon: "✅",
  },
  reopened: {
    label: "Reopened",
    bg: "bg-amber-950/50",
    text: "text-amber-300",
    border: "border-amber-800",
    icon: "🔄",
  },
  verified: {
    label: "Verified",
    bg: "bg-emerald-950/50",
    text: "text-emerald-300",
    border: "border-emerald-800",
    icon: "✔️",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-950/50",
    text: "text-red-300",
    border: "border-red-800",
    icon: "❌",
  },
  duplicate: {
    label: "Duplicate",
    bg: "bg-gray-800/50",
    text: "text-gray-300",
    border: "border-gray-700",
    icon: "📋",
  },
};

// ─── Resolved-like Statuses ─────────────────────────────

export const RESOLVED_STATUSES = new Set(["resolved", "rejected", "duplicate", "verified"]);

export function isResolvedStatus(status?: string): boolean {
  return !!status && RESOLVED_STATUSES.has(status);
}

// ─── Area Types ─────────────────────────────────────────

export const AREA_TYPES: { value: AreaType; label: string }[] = [
  { value: "ward", label: "Ward" },
  { value: "suburb", label: "Suburb" },
  { value: "district", label: "District" },
  { value: "municipality", label: "Municipality" },
  { value: "campus", label: "Campus" },
  { value: "estate-zone", label: "Estate Zone" },
  { value: "region", label: "Region" },
  { value: "custom", label: "Custom" },
];

// ─── Organization Types ─────────────────────────────────

export const ORGANIZATION_TYPES: OrganizationType[] = [
  "Municipality",
  "Political Organisation",
  "NGO",
  "University",
  "School",
  "Estate",
  "Residents Association",
  "Community Organisation",
  "Private Company",
  "Other",
];

// ─── Notification Type Icons ────────────────────────────

export const NOTIFICATION_ICONS: Record<string, string> = {
  status: "📋",
  assignment: "👤",
  comment: "💬",
  confirmation: "👍",
  escalation: "🔺",
  dispute: "⚖️",
  resolution: "✅",
  invite: "📨",
  "sla-warning": "⏰",
  system: "🔔",
};

// ─── Escalation Levels ──────────────────────────────────

export const ESCALATION_LEVELS: { value: number; label: string }[] = [
  { value: 0, label: "Normal" },
  { value: 1, label: "Supervisor" },
  { value: 2, label: "Manager" },
  { value: 3, label: "Urgent / Critical" },
];

// ─── Trust Score Configuration ──────────────────────────

export const TRUST_SCORE_CONFIG = {
  initial: 50,
  min: 0,
  max: 100,
  rewards: {
    reportResolved: 5,
    usefulConfirmation: 2,
    reportAcknowledged: 1,
  },
  penalties: {
    reportRejected: -10,
    reportSpam: -15,
    reportFake: -20,
  },
} as const;

// ─── Moderation Reasons ─────────────────────────────────

export const MODERATION_REASONS = [
  "spam",
  "fake-report",
  "offensive-content",
  "duplicate",
  "invalid-location",
  "irrelevant",
] as const;

// ─── SLA Defaults ───────────────────────────────────────

export const DEFAULT_SLA = {
  acknowledgementTargetHours: 24,
  resolutionTargetHours: 168, // 7 days
} as const;

// ─── Subscription Plans ─────────────────────────────────

export const SUBSCRIPTION_PLANS = {
  pilot: {
    name: "Pilot",
    maxStaff: 3,
    maxReportsPerMonth: 50,
    analyticsEnabled: false,
    exportsEnabled: false,
    apiEnabled: false,
    brandingEnabled: false,
  },
  starter: {
    name: "Starter",
    maxStaff: 10,
    maxReportsPerMonth: 200,
    analyticsEnabled: true,
    exportsEnabled: true,
    apiEnabled: false,
    brandingEnabled: false,
  },
  professional: {
    name: "Professional",
    maxStaff: 50,
    maxReportsPerMonth: 1000,
    analyticsEnabled: true,
    exportsEnabled: true,
    apiEnabled: true,
    brandingEnabled: true,
  },
  enterprise: {
    name: "Enterprise",
    maxStaff: -1, // unlimited
    maxReportsPerMonth: -1,
    analyticsEnabled: true,
    exportsEnabled: true,
    apiEnabled: true,
    brandingEnabled: true,
  },
} as const;

// ─── Distance Utilities ─────────────────────────────────

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

// ─── Time Formatting ────────────────────────────────────

/**
 * Format a Firestore timestamp or Date to a relative time string.
 */
export function formatRelativeTime(date: Date | { toDate(): Date } | null | undefined): string {
  if (!date) return "";

  const d = date instanceof Date ? date : date.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format a Firestore timestamp or Date to a full date/time string.
 */
export function formatDateTime(date: Date | { toDate(): Date } | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Geohash Utilities ──────────────────────────────────

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode a lat/lng pair to a geohash string.
 * Precision determines the length of the hash (default 7 ≈ ~150m accuracy).
 */
export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision: number = 7
): string {
  const latRange = [-90.0, 90.0];
  const lonRange = [-180.0, 180.0];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (longitude > mid) {
        ch |= 1 << (4 - bit);
        lonRange[0] = mid;
      } else {
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (latitude > mid) {
        ch |= 1 << (4 - bit);
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }

    even = !even;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Get geohash neighbors and self for a bounding-box-style nearby search.
 * Returns geohash prefixes that cover the vicinity of the given coordinates.
 */
export function getGeohashRange(
  latitude: number,
  longitude: number,
  radiusMeters: number
): { lower: string; upper: string } {
  // Use precision based on radius
  let precision = 7;
  if (radiusMeters > 5000) precision = 4;
  else if (radiusMeters > 1000) precision = 5;
  else if (radiusMeters > 200) precision = 6;

  const hash = encodeGeohash(latitude, longitude, precision);

  // Simple range: get the geohash and create a range that covers nearby cells
  const lower = hash;
  const upper = hash.slice(0, -1) + BASE32[BASE32.indexOf(hash.slice(-1)) + 1] || hash + "~";

  return { lower, upper };
}

// ─── Image Compression ──────────────────────────────────

/**
 * Compress an image file using the Canvas API.
 * Returns a new Blob with the compressed image.
 *
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels (default: 1920)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;

      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
