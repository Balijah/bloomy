/**
 * yieldGoal.ts
 *
 * Three layered analyses — all pure functions, no extra API calls:
 *
 *  1. Yield goal tracker   — forecast vs farmer's target (bu/acre)
 *  2. Revenue projection   — gross revenue at goal rate and forecast range
 *  3. Breakeven analysis   — minimum yield to cover production costs,
 *                            profit-at-forecast, and safety margin
 *
 * Requires: cropPrice for revenue + breakeven; costPerAcre for breakeven.
 */

import {
  computeYieldForecast,
  YIELD_PROFILES_PUBLIC as YIELD_PROFILES,
  type RiskLevel,
} from "@/lib/yieldForecast";
import { getCurrentStage } from "@/lib/cropStages";
import type { AgricultureInsights } from "@workspace/api-client-react";

// ── Reference market prices ───────────────────────────────────────────────────

export const CROP_MARKET_PRICES: Record<string, { price: number; label: string }> = {
  corn:         { price: 4.50,   label: "≈ $4.50/bu (CBOT futures)" },
  soybeans:     { price: 12.00,  label: "≈ $12.00/bu (CBOT futures)" },
  winter_wheat: { price: 6.50,   label: "≈ $6.50/bu (CBOT futures)" },
  cotton:       { price: 0.85,   label: "≈ $0.85/lb (ICE futures)" },
  potatoes:     { price: 8.50,   label: "≈ $8.50/cwt (USDA avg)" },
  grapes:       { price: 800,    label: "≈ $800/ton (USDA NASS)" },
  almonds:      { price: 2.50,   label: "≈ $2.50/lb (Blue Diamond avg)" },
  apples:       { price: 350,    label: "≈ $350/ton (USDA NASS)" },
  rice:         { price: 14.00,  label: "≈ $14.00/bu (USDA avg)" },
};

// Reference cost-per-acre hints (USDA Economic Research Service estimates)
export const CROP_COST_HINTS: Record<string, { cost: number; label: string }> = {
  corn:         { cost: 850,   label: "≈ $850/acre (USDA ERS)" },
  soybeans:     { cost: 450,   label: "≈ $450/acre (USDA ERS)" },
  winter_wheat: { cost: 350,   label: "≈ $350/acre (USDA ERS)" },
  cotton:       { cost: 700,   label: "≈ $700/acre (USDA ERS)" },
  potatoes:     { cost: 2800,  label: "≈ $2,800/acre (USDA ERS)" },
  grapes:       { cost: 4500,  label: "≈ $4,500/acre (USDA ERS)" },
  almonds:      { cost: 3200,  label: "≈ $3,200/acre (USDA ERS)" },
  apples:       { cost: 6000,  label: "≈ $6,000/acre (USDA ERS)" },
  rice:         { cost: 600,   label: "≈ $600/acre (USDA ERS)" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalStatus =
  | "exceeds_goal"
  | "on_track"
  | "at_risk"
  | "below_goal";

export type BreakevenStatus =
  | "profitable"   // projectedMid comfortably above breakeven (>10% margin)
  | "tight"        // projectedMid above breakeven but within 10%
  | "at_risk"      // projectedLow below breakeven; mid above
  | "unprofitable"; // projectedMid at or below breakeven

export interface RevenueProjection {
  pricePerUnit: number;
  priceUnit: string;
  goalRevenue: number | null;
  projectedRevenueMid: number | null;
  projectedRevenueLow: number | null;
  projectedRevenueHigh: number | null;
  revenueGap: number | null;
}

export interface BreakevenAnalysis {
  /** Minimum yield per acre to cover all costs (costPerAcre / cropPrice) */
  breakevenYield: number;
  /** Total farm cost (costPerAcre × acreage); null if no acreage */
  totalFarmCost: number | null;
  /**
   * Safety margin = (projectedMid − breakevenYield) / projectedMid × 100
   * Negative means the forecast falls short of breakeven.
   */
  safetyMarginPct: number;
  /** Forecast covers X% of costs: projectedMid / breakevenYield × 100 */
  coverageRatioPct: number;
  /** Net profit at forecast midpoint × acreage; null if no acreage */
  projectedProfitMid: number | null;
  /** Net profit at low-end forecast × acreage; null if no acreage */
  projectedProfitLow: number | null;
  /** Net profit at high-end forecast × acreage; null if no acreage */
  projectedProfitHigh: number | null;
  /** Net profit at goal yield × acreage; null if no goal or no acreage */
  profitAtGoal: number | null;
  status: BreakevenStatus;
  statusColor: string;
  statusLabel: string;
  statusDetail: string;
  /** Short unit string for the crop price, e.g. "/bu" */
  priceUnit: string;
}

export interface YieldGoalResult {
  hasGoal: boolean;
  goalValue: number | null;
  unit: string;
  unitLong: string;
  projectedLow: number;
  projectedHigh: number;
  projectedMid: number;
  percentOfGoalMid: number | null;
  status: GoalStatus;
  statusColor: string;
  statusLabel: string;
  statusDetail: string;
  gap: number | null;
  gapPct: number | null;
  goalTotalProduction: number | null;
  projectedTotalProduction: number | null;
  revenue: RevenueProjection | null;
  breakeven: BreakevenAnalysis | null;
  insights: string[];
}

// ── Status meta ───────────────────────────────────────────────────────────────

const GOAL_STATUS_META: Record<GoalStatus, { color: string; label: string; detail: string }> = {
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
    detail: "Season stress could push yields below your target. Take action now.",
  },
  below_goal: {
    color: "#D02020",
    label: "Below goal",
    detail: "Current conditions suggest yields may fall short of your goal.",
  },
};

const BREAKEVEN_STATUS_META: Record<
  BreakevenStatus,
  { color: string; label: string; detail: string }
> = {
  profitable: {
    color: "#2D9B5A",
    label: "Profitable",
    detail: "Forecast comfortably covers production costs with room to spare.",
  },
  tight: {
    color: "#366441",
    label: "Tight margin",
    detail: "Forecast covers costs but the margin is thin — watch conditions closely.",
  },
  at_risk: {
    color: "#E8A020",
    label: "Breakeven at risk",
    detail: "A poor growing season could push yields below your breakeven point.",
  },
  unprofitable: {
    color: "#D02020",
    label: "Below breakeven",
    detail: "Current forecast falls short of covering production costs.",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGoalStatus(
  goalValue: number,
  projectedMid: number,
  projectedHigh: number
): GoalStatus {
  if (projectedHigh >= goalValue) return "exceeds_goal";
  if (projectedMid >= goalValue * 0.9) return "on_track";
  if (projectedMid >= goalValue * 0.75) return "at_risk";
  return "below_goal";
}

function priceUnitFrom(profileUnit: string): string {
  return `/${profileUnit.split("/")[0].trim()}`;
}

function buildRevenue(params: {
  cropPrice: number;
  profileUnit: string;
  goalTotalProduction: number | null;
  projectedTotalProduction: number | null;
  projectedLow: number;
  projectedHigh: number;
  acreage: number | null | undefined;
}): RevenueProjection {
  const {
    cropPrice, profileUnit,
    goalTotalProduction, projectedTotalProduction,
    projectedLow, projectedHigh, acreage,
  } = params;

  const priceUnit = priceUnitFrom(profileUnit);
  const goalRevenue = goalTotalProduction != null
    ? Math.round(goalTotalProduction * cropPrice) : null;
  const projectedRevenueMid = projectedTotalProduction != null
    ? Math.round(projectedTotalProduction * cropPrice) : null;
  const projectedRevenueLow = acreage != null
    ? Math.round(projectedLow * acreage * cropPrice) : null;
  const projectedRevenueHigh = acreage != null
    ? Math.round(projectedHigh * acreage * cropPrice) : null;
  const revenueGap = goalRevenue != null && projectedRevenueMid != null
    ? goalRevenue - projectedRevenueMid : null;

  return {
    pricePerUnit: cropPrice, priceUnit,
    goalRevenue, projectedRevenueMid,
    projectedRevenueLow, projectedRevenueHigh, revenueGap,
  };
}

function buildBreakeven(params: {
  costPerAcre: number;
  cropPrice: number;
  profileUnit: string;
  projectedLow: number;
  projectedMid: number;
  projectedHigh: number;
  goalValue: number | null;
  acreage: number | null | undefined;
}): BreakevenAnalysis {
  const {
    costPerAcre, cropPrice, profileUnit,
    projectedLow, projectedMid, projectedHigh,
    goalValue, acreage,
  } = params;

  const breakevenYield = costPerAcre / cropPrice;
  const totalFarmCost = acreage != null ? Math.round(costPerAcre * acreage) : null;

  const safetyMarginPct = Math.round(
    ((projectedMid - breakevenYield) / projectedMid) * 100
  );
  const coverageRatioPct = Math.round((projectedMid / breakevenYield) * 100);

  const profitPerUnit = cropPrice;
  const profitMid = (projectedMid - breakevenYield) * profitPerUnit;
  const profitLow  = (projectedLow  - breakevenYield) * profitPerUnit;
  const profitHigh = (projectedHigh - breakevenYield) * profitPerUnit;

  const projectedProfitMid  = acreage != null ? Math.round(profitMid  * acreage) : null;
  const projectedProfitLow  = acreage != null ? Math.round(profitLow  * acreage) : null;
  const projectedProfitHigh = acreage != null ? Math.round(profitHigh * acreage) : null;

  const profitAtGoal =
    goalValue != null && acreage != null
      ? Math.round((goalValue - breakevenYield) * profitPerUnit * acreage)
      : null;

  // Status: based on projectedMid vs breakeven and whether low end dips below
  let status: BreakevenStatus;
  if (projectedMid <= breakevenYield) {
    status = "unprofitable";
  } else if (projectedLow < breakevenYield) {
    status = "at_risk";
  } else if (safetyMarginPct < 10) {
    status = "tight";
  } else {
    status = "profitable";
  }

  const meta = BREAKEVEN_STATUS_META[status];

  return {
    breakevenYield: Math.round(breakevenYield * 10) / 10, // 1 decimal
    totalFarmCost,
    safetyMarginPct,
    coverageRatioPct,
    projectedProfitMid,
    projectedProfitLow,
    projectedProfitHigh,
    profitAtGoal,
    status,
    statusColor: meta.color,
    statusLabel: meta.label,
    statusDetail: meta.detail,
    priceUnit: priceUnitFrom(profileUnit),
  };
}

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
    tips.push("Review scouting notes for disease or pest pressure cutting into yield potential.");
    tips.push("Ensure adequate late-season nutrition and irrigation to close the gap.");
  } else {
    tips.push(
      `Forecast is ${Math.round(Math.abs(gap))} ${YIELD_PROFILES[cropType]?.unit ?? "units"}/acre below your goal.`
    );
    tips.push("Significant stress or adverse weather is the likely driver — document conditions for crop insurance.");
    tips.push("Re-evaluate your yield goal for this season; consider adjusting market contracts accordingly.");
  }

  return tips;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeYieldGoal({
  insights,
  goalValue,
  acreage,
  cropPrice,
  costPerAcre,
}: {
  insights: AgricultureInsights;
  goalValue: number | null | undefined;
  acreage: number | null | undefined;
  cropPrice: number | null | undefined;
  costPerAcre: number | null | undefined;
}): YieldGoalResult {
  const {
    cropType, accumulatedGDD,
    frostRisk, heatStressRisk, droughtRisk, harvestDisruptionRisk,
    precipitationDeficit, extremeEventsNext15Days,
  } = insights;

  const stageResult = accumulatedGDD != null
    ? getCurrentStage(cropType, accumulatedGDD)
    : { currentIndex: 0, stages: [null, null, null, null, null] };

  const criticalEventCount = (extremeEventsNext15Days ?? []).filter(
    (e) => e.severity === "critical"
  ).length;

  const forecast = computeYieldForecast({
    cropType,
    currentStageIndex: stageResult.currentIndex,
    totalStages: stageResult.stages.length,
    frostRiskLevel:              (frostRisk?.level              ?? "none") as RiskLevel,
    heatStressRiskLevel:         (heatStressRisk?.level         ?? "none") as RiskLevel,
    droughtRiskLevel:            (droughtRisk?.level            ?? "none") as RiskLevel,
    harvestDisruptionRiskLevel:  (harvestDisruptionRisk?.level  ?? "none") as RiskLevel,
    precipitationDeficit: precipitationDeficit ?? 0,
    criticalEventCount,
  });

  const { estimatedLow, estimatedHigh, profile, totalStressPenalty } = forecast;
  const projectedMid = Math.round((estimatedLow + estimatedHigh) / 2);

  const hasGoal    = goalValue  != null && goalValue  > 0;
  const hasCropPrice  = cropPrice   != null && cropPrice  > 0;
  const hasCostPerAcre = costPerAcre != null && costPerAcre > 0;

  const goalTotalProduction = hasGoal && acreage
    ? Math.round(goalValue! * acreage) : null;
  const projectedTotalProduction = acreage
    ? Math.round(projectedMid * acreage) : null;

  // Revenue projection (requires price)
  const revenue = hasCropPrice
    ? buildRevenue({
        cropPrice: cropPrice!,
        profileUnit: profile.unit,
        goalTotalProduction,
        projectedTotalProduction,
        projectedLow: estimatedLow,
        projectedHigh: estimatedHigh,
        acreage,
      })
    : null;

  // Breakeven analysis (requires both price and cost)
  const breakeven = hasCropPrice && hasCostPerAcre
    ? buildBreakeven({
        costPerAcre: costPerAcre!,
        cropPrice: cropPrice!,
        profileUnit: profile.unit,
        projectedLow: estimatedLow,
        projectedMid,
        projectedHigh: estimatedHigh,
        goalValue: hasGoal ? goalValue! : null,
        acreage,
      })
    : null;

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
      statusColor: GOAL_STATUS_META.on_track.color,
      statusLabel: GOAL_STATUS_META.on_track.label,
      statusDetail: GOAL_STATUS_META.on_track.detail,
      gap: null,
      gapPct: null,
      goalTotalProduction: null,
      projectedTotalProduction,
      revenue,
      breakeven,
      insights: [],
    };
  }

  const gv = goalValue!;
  const percentOfGoalMid = Math.round((projectedMid / gv) * 100);
  const gap    = gv - projectedMid;
  const gapPct = Math.round((gap / gv) * 100);
  const status = getGoalStatus(gv, projectedMid, estimatedHigh);
  const meta   = GOAL_STATUS_META[status];

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
    revenue,
    breakeven,
    insights: buildInsights(status, cropType, gap, totalStressPenalty),
  };
}

export { YIELD_PROFILES };
