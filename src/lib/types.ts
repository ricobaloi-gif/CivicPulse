/**
 * Centralized TypeScript types for CivicPulse.
 * All Firestore document shapes and shared interfaces live here.
 */

import { Timestamp } from "firebase/firestore";

// ─── Utility ────────────────────────────────────────────

export type FirestoreTimestamp = Timestamp | Date | null;

// ─── User ───────────────────────────────────────────────

export type UserRole = "resident" | "staff" | "admin";

export type OrganizationRole =
  | "owner"
  | "admin"
  | "manager"
  | "staff"
  | "viewer"
  | "member";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  trustScore: number;
  phone?: string;
  profilePhotoUrl?: string;

  // Organization membership
  organizationId?: string | null;
  organizationName?: string | null;
  organizationRole?: OrganizationRole | null;
  organizationJoinedAt?: FirestoreTimestamp;

  // Platform-level admin (separate from org admin)
  platformRole?: "platform-admin" | null;

  createdAt?: FirestoreTimestamp;
}

// ─── Organization ───────────────────────────────────────

export type OrganizationType =
  | "Municipality"
  | "Political Organisation"
  | "NGO"
  | "University"
  | "School"
  | "Estate"
  | "Residents Association"
  | "Community Organisation"
  | "Private Company"
  | "Other";

export type SubscriptionPlan =
  | "pilot"
  | "starter"
  | "professional"
  | "enterprise";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "expired"
  | "cancelled";

export interface Organization {
  id?: string;
  name: string;
  type: OrganizationType;
  description: string;
  city: string;
  province: string;
  country: string;
  ownerId: string;
  createdBy: string;
  status: "active" | "inactive" | "suspended";
  memberCount: number;

  // Branding
  logo?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  shortDescription?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;

  // SLA targets
  acknowledgementTargetHours?: number | null;
  resolutionTargetHours?: number | null;

  // Subscription
  plan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartedAt?: FirestoreTimestamp;
  subscriptionEndsAt?: FirestoreTimestamp;

  // Plan limits
  maxStaff?: number;
  maxReportsPerMonth?: number;
  analyticsEnabled?: boolean;
  exportsEnabled?: boolean;
  apiEnabled?: boolean;
  brandingEnabled?: boolean;

  // Usage tracking
  reportsThisMonth?: number;
  reportsMonthStart?: FirestoreTimestamp;

  // Categories/severity config
  permittedCategories?: string[];
  defaultSeverity?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ─── Report ─────────────────────────────────────────────

export type ReportCategory =
  | "Pothole"
  | "Water Leak"
  | "Power Outage"
  | "Broken Streetlight"
  | "Illegal Dumping"
  | "Road Hazard"
  | "Sewer Issue"
  | "Vandalism"
  | "Other";

export type ReportSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ReportStatus =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "in-progress"
  | "resolved"
  | "reopened"
  | "verified"
  | "rejected"
  | "duplicate";

export type ModerationStatus =
  | "normal"
  | "under-review"
  | "hidden"
  | "rejected";

export type DisputeStatus =
  | "none"
  | "submitted"
  | "under-review"
  | "accepted"
  | "rejected";

export interface StatusHistoryEntry {
  status: string;
  changedAt: FirestoreTimestamp;
  changedBy: string;
  changedByName?: string;
}

export interface Report {
  id?: string;
  title: string;
  description: string;
  category: ReportCategory;
  severity: ReportSeverity;
  status: ReportStatus;
  statusHistory: StatusHistoryEntry[];

  // Location
  latitude: number;
  longitude: number;
  geohash?: string;
  address?: string;

  // Area/Ward
  areaId?: string | null;
  areaName?: string | null;
  ward?: string | null;
  municipality?: string | null;

  // Media
  imageUrl?: string | null;

  // Creator
  createdBy: string;
  createdByName?: string;

  // Organization (tenant isolation)
  organizationId?: string | null;
  organizationName?: string | null;

  // Confirmation
  confirmationCount: number;
  confirmedBy: string[];

  // Assignment
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedAt?: FirestoreTimestamp;

  // Escalation
  priority?: number;
  escalationLevel?: number;
  escalated?: boolean;
  escalatedAt?: FirestoreTimestamp;
  escalatedBy?: string | null;
  escalationReason?: string | null;

  // Resolution evidence
  resolutionNote?: string | null;
  resolvedAt?: FirestoreTimestamp;
  resolvedBy?: string | null;
  resolutionImageUrls?: string[];

  // Dispute
  disputeStatus?: DisputeStatus;
  disputeReason?: string | null;
  disputedAt?: FirestoreTimestamp;
  disputedBy?: string | null;

  // Moderation
  moderationStatus?: ModerationStatus;
  moderationReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: FirestoreTimestamp;

  // SLA timestamps
  submittedAt?: FirestoreTimestamp;
  acknowledgedAt?: FirestoreTimestamp;
  workStartedAt?: FirestoreTimestamp;

  // Timestamps
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;

  // Legacy field (should NOT be written for new reports)
  createdByEmail?: string;
}

// ─── Case Note (subcollection: reports/{id}/caseNotes) ──

export interface CaseNote {
  id?: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt?: FirestoreTimestamp;
}

// ─── Public Comment (subcollection: reports/{id}/comments)

export interface Comment {
  id?: string;
  text: string;
  createdBy: string;
  createdByName: string;
  role: string;
  createdAt?: FirestoreTimestamp;
}

// ─── Notification ───────────────────────────────────────

export type NotificationType =
  | "status"
  | "assignment"
  | "comment"
  | "confirmation"
  | "escalation"
  | "dispute"
  | "resolution"
  | "invite"
  | "sla-warning"
  | "system";

export interface Notification {
  id?: string;
  userId: string;
  createdBy: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string | null;
  read: boolean;
  createdAt?: FirestoreTimestamp;
}

// ─── Organization Invite ────────────────────────────────

export type InviteStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "cancelled";

export interface OrganizationInvite {
  id?: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: UserRole;
  organizationRole: OrganizationRole;
  status: InviteStatus;
  invitedBy: string;
  invitedByName?: string;
  createdAt?: FirestoreTimestamp;
  expiresAt?: FirestoreTimestamp;
  acceptedAt?: FirestoreTimestamp;
  acceptedBy?: string | null;
}

// ─── Area / Ward ────────────────────────────────────────

export type AreaType =
  | "ward"
  | "suburb"
  | "district"
  | "municipality"
  | "campus"
  | "estate-zone"
  | "region"
  | "custom";

export interface Area {
  id?: string;
  name: string;
  type: AreaType;
  code?: string;
  description?: string;
  municipality?: string;
  province?: string;
  country?: string;
  active: boolean;
  assignedStaff?: string[];
  createdAt?: FirestoreTimestamp;
  createdBy?: string;
}

// ─── Audit Log ──────────────────────────────────────────

export type AuditAction =
  | "status_changed"
  | "case_assigned"
  | "case_reassigned"
  | "assignment_removed"
  | "report_escalated"
  | "report_resolved"
  | "report_reopened"
  | "dispute_reviewed"
  | "moderation_performed"
  | "member_added"
  | "member_removed"
  | "invite_created"
  | "invite_cancelled"
  | "invite_accepted"
  | "org_settings_changed"
  | "report_created"
  | "trust_score_updated"
  | "export_generated"
  | "area_created"
  | "area_updated";

export interface AuditLogEntry {
  id?: string;
  organizationId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  timestamp?: FirestoreTimestamp;
  metadata?: Record<string, unknown>;
}

// ─── API Key ────────────────────────────────────────────

export interface ApiKey {
  id?: string;
  organizationId: string;
  name: string;
  keyHash: string;
  prefix: string;
  permissions: string[];
  active: boolean;
  lastUsedAt?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  createdBy: string;
}

// ─── Permission Flags ───────────────────────────────────

export interface PermissionFlags {
  manageMembers: boolean;
  manageReports: boolean;
  assignCases: boolean;
  manageAreas: boolean;
  viewAnalytics: boolean;
  manageBilling: boolean;
  manageSettings: boolean;
  moderateReports: boolean;
  exportData: boolean;
}

/**
 * Returns default permission flags based on organization role.
 */
export function getDefaultPermissions(
  orgRole: OrganizationRole | null | undefined
): PermissionFlags {
  switch (orgRole) {
    case "owner":
      return {
        manageMembers: true,
        manageReports: true,
        assignCases: true,
        manageAreas: true,
        viewAnalytics: true,
        manageBilling: true,
        manageSettings: true,
        moderateReports: true,
        exportData: true,
      };
    case "admin":
      return {
        manageMembers: true,
        manageReports: true,
        assignCases: true,
        manageAreas: true,
        viewAnalytics: true,
        manageBilling: false,
        manageSettings: true,
        moderateReports: true,
        exportData: true,
      };
    case "manager":
      return {
        manageMembers: false,
        manageReports: true,
        assignCases: true,
        manageAreas: true,
        viewAnalytics: true,
        manageBilling: false,
        manageSettings: false,
        moderateReports: true,
        exportData: true,
      };
    case "staff":
      return {
        manageMembers: false,
        manageReports: false,
        assignCases: false,
        manageAreas: false,
        viewAnalytics: false,
        manageBilling: false,
        manageSettings: false,
        moderateReports: false,
        exportData: false,
      };
    case "viewer":
      return {
        manageMembers: false,
        manageReports: false,
        assignCases: false,
        manageAreas: false,
        viewAnalytics: true,
        manageBilling: false,
        manageSettings: false,
        moderateReports: false,
        exportData: false,
      };
    case "member":
    default:
      return {
        manageMembers: false,
        manageReports: false,
        assignCases: false,
        manageAreas: false,
        viewAnalytics: false,
        manageBilling: false,
        manageSettings: false,
        moderateReports: false,
        exportData: false,
      };
  }
}
