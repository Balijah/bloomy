/**
 * yieldGoal.ts
 *
 * Compares a farmer's self-set yield goal (bu/acre, lbs/acre, etc.) against
 * the season's weather-adjusted forecast range from computeYieldForecast().
 *
 * All inputs are already loaded in the farm detail screen — no extra API calls.
 */

import {
  computeYieldForecast,
  YIELD_PROFILES_PUBLIC as YIELD_PROFILES,
  type RiskLevel,
} from "@/lib/yieldForecast";
import { getCurrentStage } from "@/lib/cropStages";
import type { AgricultureInsights } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalStatus =
  | "exceeds_goal"  // forecast high > goal
  | "on_track"      // forecast mid >= 90 % of goal
  | "at_risk"       // forecast low >= 75 % of goal
  | "below_goal";   // below 75 % of goal

export interface YieldGoalResult {
  hasGoal: boolean;
  goalValue: number | null;
  unit: string;
  unitLong: string;
  projectedLow: number;
  projectedHigh: number;
  projectedMid: number;
  /** Forecast midpoint as % of goal (null if no goal) */
  percentOfGoalMid: number | null;
  status: GoalStatus;
  statusColor: string;
  statusLabel: string;
  statusDetail: string;
  /** gap = goal − projectedMid; negative = exceeding goal */
  gap: number | null;
  /** gap as % of goal */
  gapPct: number | null;
  /** Total production at goal rate (goal × acreage); null if no acreage */
  goalTotalProduction: number | null;
  /** Projected mid total production (projectedMid × acreage) */
  projectedTotalProduction: number | null;
  /** Actionable bullets shown below the comparison */
  insights: string[];
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  GoalStatus,
  { color: string; label: string; detail: string }
> = {
  exceeds_goal: {
    color: "#2D9B5A",
    label: "Exceeds goal",
    detail: "Forecast range puts you above your yield target.",
  },
  on_track: {
    color: "#366441",
    label: "On track",
    detail: "Projected yields are within reach of your goal.",
  },
  at_risk: {
    color: "#E8A020",
    label: "At risk",
    detail:
      "Season stress could push yields below your target. Take action now.",
  },
  below_goal: {
    color: "#D02020",
    label: "Below goal",
    detail: "Current conditions suggest yields may fall short of your goal.",
  },
};

function getStatus(
  goalValue: number,
  projectedMid: number,
  projectedHigh: number
): GoalStatus {
  if (projectedHigh >= goalValue * 1.0) return "exceeds_goal";
  if (projectedMid >= goalValue * 0.9) return "on_track";
  if (projectedMid >= goalValue * 0.75) return "at_risk";
  return "below_goal";
}

// ── Insight bullets ───────────────────────────────────────────────────────────

function buildInsights(
  status: GoalStatus,
  cropType: string,
  gap: number,
  stressPenalty: number
): string[] {
  const tips: string[] = [];

  if (status === "exceeds_goal" || status === "on_track") {
    tips.push("Maintain current inputs — conditions are supporting your goal.");
    if (stressPenalty > 0.05)
      tips.push(
        `Season stress has reduced the forecast by ${Math.round(stressPenalty * 100)}% — monitor field conditions to protect the gain.`
      );
    else
      tips.push("No significant stress factors detected. Keep up timely field operations.");
  } else if (status === "at_risk") {
    tips.push(
      `You need ~${Math.round(Math.abs(gap))} more ${YIELD_PROFILES[cropType]?.unit ?? "units"}/acre to hit your goal.`
    );
    tips.push(
      "Review scouting notes for disease or pest pressure cutting into yield potential."
    );
    tips.push(
      "Ensure adequate late-season nutrition and irrigation to close the gap."
    );
  } else {
    // below_goal
    tips.push(
      `Forecast is ${Math.round(Math.abs(gap))} ${YIELD_PROFILES[cropType]?.unit ?? "units"}/acre below your goal.`
    );
    tips.push(
      "Significant stress or adverse weather is the likely driver — document conditions for crop insurance."
    );
    tips.push(
      "Re-evaluate your yield goal for this season; consider adjusting market contracts accordingly."
    );
  }

  return tips;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeYieldGoal({
  insights,
  goalValue,
  acreage,
}: {
  insights: AgricultureInsights;
  goalValue: number | null | undefined;
  acreage: number | null | undefined;
}): YieldGoalResult {
  const {
    cropType,
    accumulatedGDD,
    frostRisk,
    heatStressRisk,
    droughtRisk,
    harvestDisruptionRisk,
    precipitationDeficit,
    extremeEventsNext15Days,
  } = insights;

  // Always compute the forecast, even without a goal, so we have the numbers
  const stageResult =
    accumulatedGDD != null
      ? getCurrentStage(cropType, accumulatedGDD)
      : { currentIndex: 0, stages: [null, null, null, null, null] };

  const criticalEventCount = (extremeEventsNext15Days ?? []).filter(
    (e) => e.severity === "critical"
  ).length;

  const forecast = computeYieldForecast({
    cropType,
    currentStageIndex: stageResult.currentIndex,
    totalStages: stageResult.stages.length,
    frostRiskLevel: (frostRisk?.level ?? "none") as RiskLevel,
    heatStressRiskLevel: (heatStressRisk?.level ?? "none") as RiskLevel,
    droughtRiskLevel: (droughtRisk?.level ?? "none") as RiskLevel,
    harvestDisruptionRiskLevel: (harvestDisruptionRisk?.level ?? "none") as RiskLevel,
    precipitationDeficit: precipitationDeficit ?? 0,
    criticalEventCount,
  });

  const { estimatedLow, estimatedHigh, profile, totalStressPenalty } = forecast;
  const projectedMid = Math.round((estimatedLow + estimatedHigh) / 2);

  const hasGoal = goalValue != null && goalValue > 0;

  // If no goal, return a "no goal" result with forecast data still populated
  if (!hasGoal) {
    return {
      hasGoal: false,
      goalValue: null,
      unit: profile.unit,
      unitLong: profile.unitLong,
      projectedLow: estimatedLow,
      projectedHigh: estimatedHigh,
      projectedMid,
      percentOfGoalMid: null,
      status: "on_track",
      statusColor: STATUS_META.on_track.color,
      statusLabel: STATUS_META.on_track.label,
      statusDetail: STATUS_META.on_track.detail,
      gap: null,
      gapPct: null,
      goalTotalProduction: null,
      projectedTotalProduction: acreage ? Math.round(projectedMid * acreage) : null,
      insights: [],
    };
  }

  const gv = goalValue!;
  const percentOfGoalMid = Math.round((projectedMid / gv) * 100);
  const gap = gv - projectedMid;
  const gapPct = Math.round((gap / gv) * 100);
  const status = getStatus(gv, projectedMid, estimatedHigh);
  const meta = STATUS_META[status];

  const goalTotalProduction = acreage ? Math.round(gv * acreage) : null;
  const projectedTotalProduction = acreage
    ? Math.round(projectedMid * acreage)
    : null;

  const tips = buildInsights(status, cropType, gap, totalStressPenalty);

  return {
    hasGoal: true,
    goalValue: gv,
    unit: profile.unit,
    unitLong: profile.unitLong,
    projectedLow: estimatedLow,
    projectedHigh: estimatedHigh,
    projectedMid,
    percentOfGoalMid,
    status,
    statusColor: meta.color,
    statusLabel: meta.label,
    statusDetail: meta.detail,
    gap,
    gapPct,
    goalTotalProduction,
    projectedTotalProduction,
    insights: tips,
  };
}

// Re-export profile lookup for use in the edit form unit hint
export { YIELD_PROFILES };
