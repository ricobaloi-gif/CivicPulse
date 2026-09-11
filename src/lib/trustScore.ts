/**
 * Trust Score calculator for CivicPulse.
 *
 * Uses a transparent, deterministic scoring system (NO AI).
 *
 * Point values:
 *   +5  Report resolved successfully
 *   +2  Useful confirmation (user confirmed a valid report)
 *   +1  Report acknowledged by staff
 *   -10 Report rejected
 *   -15 Report flagged as spam
 *   -20 Report flagged as fake
 *
 * Score range: 0–100 (clamped)
 * Initial score: 50
 */

import { TRUST_SCORE_CONFIG } from "./constants";

export type TrustScoreEvent =
  | "report_resolved"
  | "useful_confirmation"
  | "report_acknowledged"
  | "report_rejected"
  | "report_spam"
  | "report_fake";

/**
 * Calculate the point change for a trust score event.
 */
export function getTrustScoreDelta(event: TrustScoreEvent): number {
  switch (event) {
    case "report_resolved":
      return TRUST_SCORE_CONFIG.rewards.reportResolved;
    case "useful_confirmation":
      return TRUST_SCORE_CONFIG.rewards.usefulConfirmation;
    case "report_acknowledged":
      return TRUST_SCORE_CONFIG.rewards.reportAcknowledged;
    case "report_rejected":
      return TRUST_SCORE_CONFIG.penalties.reportRejected;
    case "report_spam":
      return TRUST_SCORE_CONFIG.penalties.reportSpam;
    case "report_fake":
      return TRUST_SCORE_CONFIG.penalties.reportFake;
    default:
      return 0;
  }
}

/**
 * Calculate a new trust score after applying a delta.
 * Clamps the result to [0, 100].
 */
export function calculateNewTrustScore(
  currentScore: number,
  event: TrustScoreEvent
): number {
  const delta = getTrustScoreDelta(event);
  const newScore = currentScore + delta;
  return Math.max(
    TRUST_SCORE_CONFIG.min,
    Math.min(TRUST_SCORE_CONFIG.max, newScore)
  );
}

/**
 * Get a reputation label based on trust score.
 */
export function getTrustLabel(score: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 80)
    return { label: "Trusted", color: "text-green-400", icon: "⭐" };
  if (score >= 60)
    return { label: "Reliable", color: "text-blue-400", icon: "👍" };
  if (score >= 40)
    return { label: "Standard", color: "text-gray-400", icon: "👤" };
  if (score >= 20)
    return { label: "New / Low", color: "text-yellow-400", icon: "⚠️" };
  return { label: "Flagged", color: "text-red-400", icon: "🚩" };
}

/**
 * Human-readable description of a trust score event.
 */
export function describeTrustEvent(event: TrustScoreEvent): string {
  const delta = getTrustScoreDelta(event);
  const sign = delta >= 0 ? "+" : "";

  switch (event) {
    case "report_resolved":
      return `Report resolved (${sign}${delta})`;
    case "useful_confirmation":
      return `Useful confirmation (${sign}${delta})`;
    case "report_acknowledged":
      return `Report acknowledged (${sign}${delta})`;
    case "report_rejected":
      return `Report rejected (${sign}${delta})`;
    case "report_spam":
      return `Report flagged as spam (${sign}${delta})`;
    case "report_fake":
      return `Report flagged as fake (${sign}${delta})`;
    default:
      return "Unknown event";
  }
}
