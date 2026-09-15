import { describe, it, expect } from "vitest";
import {
  calculateNewTrustScore,
  getTrustScoreDelta,
  getTrustLabel,
  describeTrustEvent,
} from "../trustScore";
import { TRUST_SCORE_CONFIG } from "../constants";

describe("Trust Score", () => {
  describe("TRUST_SCORE_CONFIG", () => {
    it("should have correct config values", () => {
      expect(TRUST_SCORE_CONFIG.initial).toBe(50);
      expect(TRUST_SCORE_CONFIG.min).toBe(0);
      expect(TRUST_SCORE_CONFIG.max).toBe(100);
    });

    it("should have reward values", () => {
      expect(TRUST_SCORE_CONFIG.rewards.reportResolved).toBe(5);
      expect(TRUST_SCORE_CONFIG.rewards.usefulConfirmation).toBe(2);
      expect(TRUST_SCORE_CONFIG.rewards.reportAcknowledged).toBe(1);
    });

    it("should have penalty values", () => {
      expect(TRUST_SCORE_CONFIG.penalties.reportRejected).toBe(-10);
      expect(TRUST_SCORE_CONFIG.penalties.reportSpam).toBe(-15);
      expect(TRUST_SCORE_CONFIG.penalties.reportFake).toBe(-20);
    });
  });

  describe("getTrustScoreDelta", () => {
    it("should return correct deltas for rewards", () => {
      expect(getTrustScoreDelta("report_resolved")).toBe(5);
      expect(getTrustScoreDelta("useful_confirmation")).toBe(2);
      expect(getTrustScoreDelta("report_acknowledged")).toBe(1);
    });

    it("should return correct deltas for penalties", () => {
      expect(getTrustScoreDelta("report_rejected")).toBe(-10);
      expect(getTrustScoreDelta("report_spam")).toBe(-15);
      expect(getTrustScoreDelta("report_fake")).toBe(-20);
    });
  });

  describe("calculateNewTrustScore", () => {
    it("should calculate positive changes for rewards", () => {
      expect(calculateNewTrustScore(50, "report_resolved")).toBe(55);
      expect(calculateNewTrustScore(50, "useful_confirmation")).toBe(52);
      expect(calculateNewTrustScore(50, "report_acknowledged")).toBe(51);
    });

    it("should calculate negative changes for penalties", () => {
      expect(calculateNewTrustScore(50, "report_rejected")).toBe(40);
      expect(calculateNewTrustScore(50, "report_spam")).toBe(35);
      expect(calculateNewTrustScore(50, "report_fake")).toBe(30);
    });

    it("should not exceed max score", () => {
      expect(calculateNewTrustScore(98, "report_resolved")).toBe(100);
      expect(calculateNewTrustScore(100, "report_resolved")).toBe(100);
    });

    it("should not go below min score", () => {
      expect(calculateNewTrustScore(10, "report_fake")).toBe(0);
      expect(calculateNewTrustScore(0, "report_fake")).toBe(0);
    });

    it("should return same score for unknown action", () => {
      // @ts-expect-error - testing unknown action
      expect(calculateNewTrustScore(50, "unknownAction")).toBe(50);
    });
  });

  describe("getTrustLabel", () => {
    it("should return correct labels for score ranges", () => {
      expect(getTrustLabel(90)).toEqual({ label: "Trusted", color: "text-green-400", icon: "⭐" });
      expect(getTrustLabel(70)).toEqual({ label: "Reliable", color: "text-blue-400", icon: "👍" });
      expect(getTrustLabel(50)).toEqual({ label: "Standard", color: "text-gray-400", icon: "👤" });
      expect(getTrustLabel(30)).toEqual({ label: "New / Low", color: "text-yellow-400", icon: "⚠️" });
      expect(getTrustLabel(10)).toEqual({ label: "Flagged", color: "text-red-400", icon: "🚩" });
    });
  });

  describe("describeTrustEvent", () => {
    it("should return human-readable descriptions", () => {
      expect(describeTrustEvent("report_resolved")).toBe("Report resolved (+5)");
      expect(describeTrustEvent("report_rejected")).toBe("Report rejected (-10)");
      expect(describeTrustEvent("report_fake")).toBe("Report flagged as fake (-20)");
    });
  });
});