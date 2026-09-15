import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  MODERATION_REASONS,
  MODERATION_STATUSES,
  DISPUTE_STATUSES,
  AUDIT_ACTIONS,
  SEVERITY_COLORS,
  STATUS_CONFIG,
  RESOLVED_STATUSES,
  isResolvedStatus,
  calculateDistanceMeters,
  formatRelativeTime,
  formatDateTime,
  encodeGeohash,
  getGeohashRange,
  DEFAULT_SLA,
  SUBSCRIPTION_PLANS,
} from "../constants";

describe("Constants", () => {
  describe("Report Categories", () => {
    it("should have all expected categories", () => {
      expect(CATEGORIES).toEqual([
        "Pothole",
        "Water Leak",
        "Power Outage",
        "Broken Streetlight",
        "Illegal Dumping",
        "Road Hazard",
        "Sewer Issue",
        "Vandalism",
        "Other",
      ]);
    });

    it("should have 9 categories", () => {
      expect(CATEGORIES.length).toBe(9);
    });
  });

  describe("Severities", () => {
    it("should have all expected severities", () => {
      expect(SEVERITIES).toEqual(["low", "medium", "high", "critical"]);
    });
  });

  describe("Statuses", () => {
    it("should have all expected statuses", () => {
      expect(STATUSES).toEqual([
        "submitted",
        "acknowledged",
        "assigned",
        "in-progress",
        "resolved",
        "reopened",
        "verified",
        "rejected",
        "duplicate",
      ]);
    });
  });

  describe("Moderation", () => {
    it("should have expected moderation reasons", () => {
      expect(MODERATION_REASONS).toEqual([
        "spam",
        "fake-report",
        "offensive-content",
        "duplicate",
        "invalid-location",
        "irrelevant",
      ]);
    });

    it("should have expected moderation statuses", () => {
      expect(MODERATION_STATUSES).toEqual([
        "normal",
        "under-review",
        "hidden",
        "rejected",
      ]);
    });
  });

  describe("Dispute Statuses", () => {
    it("should have expected dispute statuses", () => {
      expect(DISPUTE_STATUSES).toEqual([
        "none",
        "submitted",
        "under-review",
        "accepted",
        "rejected",
      ]);
    });
  });

  describe("Audit Actions", () => {
    it("should have all audit actions defined", () => {
      expect(AUDIT_ACTIONS).toContain("status_changed");
      expect(AUDIT_ACTIONS).toContain("report_resolved");
      expect(AUDIT_ACTIONS).toContain("moderation_performed");
      expect(AUDIT_ACTIONS.length).toBeGreaterThan(15);
    });
  });
});

describe("Severity Colors", () => {
  it("should have colors for all severities", () => {
    expect(SEVERITY_COLORS.critical).toBeDefined();
    expect(SEVERITY_COLORS.high).toBeDefined();
    expect(SEVERITY_COLORS.medium).toBeDefined();
    expect(SEVERITY_COLORS.low).toBeDefined();
  });

  it("should have required color properties", () => {
    Object.values(SEVERITY_COLORS).forEach((color) => {
      expect(color.bg).toBeDefined();
      expect(color.text).toBeDefined();
      expect(color.border).toBeDefined();
      expect(color.marker).toBeDefined();
    });
  });
});

describe("Status Config", () => {
  it("should have config for all statuses", () => {
    STATUSES.forEach((status) => {
      expect(STATUS_CONFIG[status]).toBeDefined();
      expect(STATUS_CONFIG[status].label).toBeDefined();
      expect(STATUS_CONFIG[status].bg).toBeDefined();
      expect(STATUS_CONFIG[status].text).toBeDefined();
      expect(STATUS_CONFIG[status].border).toBeDefined();
    });
  });
});

describe("Resolved Statuses", () => {
  it("should correctly identify resolved statuses", () => {
    expect(isResolvedStatus("resolved")).toBe(true);
    expect(isResolvedStatus("verified")).toBe(true);
    expect(isResolvedStatus("rejected")).toBe(true);
    expect(isResolvedStatus("duplicate")).toBe(true);
  });

  it("should correctly identify non-resolved statuses", () => {
    expect(isResolvedStatus("submitted")).toBe(false);
    expect(isResolvedStatus("acknowledged")).toBe(false);
    expect(isResolvedStatus("assigned")).toBe(false);
    expect(isResolvedStatus("in-progress")).toBe(false);
    expect(isResolvedStatus("reopened")).toBe(false);
  });

  it("should handle undefined status", () => {
    expect(isResolvedStatus(undefined)).toBe(false);
  });
});

describe("Distance Calculation", () => {
  it("should calculate distance between two points", () => {
    // Distance between Johannesburg and Pretoria (~50km)
    const distance = calculateDistanceMeters(
      -26.2041,
      28.0473,
      -25.7479,
      28.2293
    );
    expect(distance).toBeGreaterThan(45000);
    expect(distance).toBeLessThan(55000);
  });

  it("should return 0 for same coordinates", () => {
    const distance = calculateDistanceMeters(0, 0, 0, 0);
    expect(distance).toBe(0);
  });
});

describe("Time Formatting", () => {
  it("should format relative time correctly", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    expect(formatRelativeTime(oneHourAgo)).toContain("h ago");
    expect(formatRelativeTime(oneDayAgo)).toContain("d ago");
    expect(formatRelativeTime(now)).toBe("Just now");
    expect(formatRelativeTime(null)).toBe("");
  });

  it("should format date time correctly", () => {
    const date = new Date("2024-01-15T14:30:00");
    const formatted = formatDateTime(date);
    expect(formatted).toContain("15");
    expect(formatted).toContain("Jan");
    expect(formatted).toContain("2024");
    expect(formatted).toContain("14:30");
    expect(formatDateTime(null)).toBe("");
  });
});

describe("Geohash", () => {
  it("should encode coordinates to geohash", () => {
    const hash = encodeGeohash(-26.2041, 28.0473, 7);
    expect(hash).toHaveLength(7);
    expect(typeof hash).toBe("string");
  });

  it("should produce different hashes for different locations", () => {
    const hash1 = encodeGeohash(-26.2041, 28.0473);
    const hash2 = encodeGeohash(-25.7479, 28.2293);
    expect(hash1).not.toBe(hash2);
  });

  it("should get geohash range", () => {
    const range = getGeohashRange(-26.2041, 28.0473, 1000);
    expect(range.lower).toBeDefined();
    expect(range.upper).toBeDefined();
  });
});

describe("SLA Defaults", () => {
  it("should have default SLA values", () => {
    expect(DEFAULT_SLA.acknowledgementTargetHours).toBe(24);
    expect(DEFAULT_SLA.resolutionTargetHours).toBe(168);
  });
});

describe("Subscription Plans", () => {
  it("should have all plan tiers", () => {
    expect(SUBSCRIPTION_PLANS.pilot).toBeDefined();
    expect(SUBSCRIPTION_PLANS.starter).toBeDefined();
    expect(SUBSCRIPTION_PLANS.professional).toBeDefined();
    expect(SUBSCRIPTION_PLANS.enterprise).toBeDefined();
  });

  it("should have correct limits for pilot", () => {
    expect(SUBSCRIPTION_PLANS.pilot.maxStaff).toBe(3);
    expect(SUBSCRIPTION_PLANS.pilot.maxReportsPerMonth).toBe(50);
    expect(SUBSCRIPTION_PLANS.pilot.analyticsEnabled).toBe(false);
  });

  it("should have unlimited for enterprise", () => {
    expect(SUBSCRIPTION_PLANS.enterprise.maxStaff).toBe(-1);
    expect(SUBSCRIPTION_PLANS.enterprise.maxReportsPerMonth).toBe(-1);
  });
});