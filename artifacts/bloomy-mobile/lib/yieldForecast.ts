/**
 * Client-side yield forecast calculator.
 *
 * Produces an estimated yield range for the season using:
 *  - Crop-specific US average baselines
 *  - GDD-based stage confidence (uncertainty narrows as season progresses)
 *  - Stress penalties computed from already-available insights risk levels
 *
 * No additional API calls are required — all inputs come from the existing
 * GetAgricultureInsightsResponse payload.
 */

// ── Yield baselines ───────────────────────────────────────────────────────────
// US national averages (USDA) with low/high representing poor vs excellent
// growing-season outcomes at typical commercial scales.

export interface YieldProfile {
  low: number;
  avg: number;
  high: number;
  /** Short display unit, e.g. "bu/acre" */
  unit: string;
  /** Longer label for UI, e.g. "bushels per acre" */
  unitLong: string;
}

export const YIELD_PROFILES_PUBLIC: Record<string, YieldProfile> = {
  corn: {
    low: 140, avg: 175, high: 220,
    unit: "bu/acre", unitLong: "bushels per acre",
  },
  soybeans: {
    low: 38, avg: 50, high: 62,
    unit: "bu/acre", unitLong: "bushels per acre",
  },
  winter_wheat: {
    low: 38, avg: 52, high: 68,
    unit: "bu/acre", unitLong: "bushels per acre",
  },
  cotton: {
    low: 700, avg: 900, high: 1100,
    unit: "lbs/acre", unitLong: "pounds per acre (lint)",
  },
  potatoes: {
    low: 300, avg: 430, high: 560,
    unit: "cwt/acre", unitLong: "hundredweight per acre",
  },
  grapes: {
    low: 3, avg: 5, high: 8,
    unit: "tons/acre", unitLong: "tons per acre",
  },
  almonds: {
    low: 1400, avg: 2000, high: 2600,
    unit: "lbs/acre", unitLong: "pounds per acre",
  },
  apples: {
    low: 15, avg: 22, high: 30,
    unit: "tons/acre", unitLong: "tons per acre",
  },
  rice: {
    low: 100, avg: 130, high: 160,
    unit: "bu/acre", unitLong: "bushels per acre",
  },
  other: {
    low: 70, avg: 100, high: 130,
    unit: "% of avg", unitLong: "percent of regional average",
  },
};

const YIELD_PROFILES = YIELD_PROFILES_PUBLIC;

// ── Stage confidence ──────────────────────────────────────────────────────────
// How many stages does this crop have before "fill" and "maturity"?
// Maps to an uncertainty band (±fraction) that shrinks as the season progresses.

const STAGE_CONFIDENCE: Record<number, { label: string; band: number }> = {
  // currentIndex → confidence descriptor + ± uncertainty fraction
  0: { label: "Early season — wide range possible", band: 0.30 },
  1: { label: "Growing season — moderate uncertainty", band: 0.20 },
  2: { label: "Yield components forming — improving confidence", band: 0.12 },
  3: { label: "Late season — higher confidence", band: 0.07 },
  4: { label: "Near harvest — tight estimate", band: 0.04 },
};

// ── Stress input types ────────────────────────────────────────────────────────

export type RiskLevel = "none" | "low" | "moderate" | "high" | "critical";

export interface YieldForecastInput {
  cropType: string;
  /** Current stage index from getCurrentStage() */
  currentStageIndex: number;
  /** Number of stages for this crop (stages.length from getCurrentStage()) */
  totalStages: number;
  frostRiskLevel: RiskLevel;
  heatStressRiskLevel: RiskLevel;
  droughtRiskLevel: RiskLevel;
  harvestDisruptionRiskLevel: RiskLevel;
  /** Inches below average over 14-day window */
  precipitationDeficit: number;
  /** Count of critical extreme events in next 15 days */
  criticalEventCount: number;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface StressItem {
  label: string;
  sublabel: string;
  /** Penalty as a 0–1 fraction */
  penalty: number;
  level: RiskLevel;
}

export type ConfidenceLevel = "low" | "moderate" | "high";

export interface YieldForecastResult {
  profile: YieldProfile;
  /** Low end of estimated yield range */
  estimatedLow: number;
  /** High end of estimated yield range */
  estimatedHigh: number;
  /** Baseline average used before stress penalties */
  baseline: number;
  /** Combined stress penalty as a 0–1 fraction (e.g. 0.12 = 12% reduction) */
  totalStressPenalty: number;
  /** Individual stress contributors */
  stressItems: StressItem[];
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  /** True if the crop is still in stage 0 and the estimate is very speculative */
  earlyEstimate: boolean;
  /** True if the crop type has no profile (generic fallback) */
  isGeneric: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function riskPenalty(level: RiskLevel): number {
  switch (level) {
    case "critical": return 0.18;
    case "high":     return 0.12;
    case "moderate": return 0.06;
    case "low":      return 0.02;
    case "none":     return 0;
  }
}

function confidenceFromBand(band: number): ConfidenceLevel {
  if (band >= 0.20) return "low";
  if (band >= 0.10) return "moderate";
  return "high";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeYieldForecast(input: YieldForecastInput): YieldForecastResult {
  const {
    cropType,
    currentStageIndex,
    totalStages,
    frostRiskLevel,
    heatStressRiskLevel,
    droughtRiskLevel,
    harvestDisruptionRiskLevel,
    precipitationDeficit,
    criticalEventCount,
  } = input;

  const profile = YIELD_PROFILES[cropType] ?? YIELD_PROFILES.other;
  const isGeneric = !(cropType in YIELD_PROFILES) || cropType === "other";

  // Stage confidence: scale the index to our 0–4 bucket regardless of total stage count
  const normalised = totalStages > 1
    ? Math.round((currentStageIndex / (totalStages - 1)) * 4)
    : 0;
  const conf = STAGE_CONFIDENCE[Math.min(normalised, 4)] ?? STAGE_CONFIDENCE[4];

  const baseline = profile.avg;

  // ── Stress items ──────────────────────────────────────────────────────────

  const stressItems: StressItem[] = [];

  const frostPenalty = riskPenalty(frostRiskLevel);
  if (frostRiskLevel !== "none") {
    stressItems.push({
      label: "Frost / Freeze Risk",
      sublabel: frostRiskLevel === "critical"
        ? "Hard freeze threatens crop survival"
        : "Cold temperatures may damage developing tissue",
      penalty: frostPenalty,
      level: frostRiskLevel,
    });
  }

  const heatPenalty = riskPenalty(heatStressRiskLevel);
  if (heatStressRiskLevel !== "none") {
    stressItems.push({
      label: "Heat Stress",
      sublabel: heatStressRiskLevel === "critical"
        ? "Multiple days above 95°F — pollination and fill at risk"
        : "Elevated temperatures may reduce kernel or fruit set",
      penalty: heatPenalty,
      level: heatStressRiskLevel,
    });
  }

  const droughtPenalty = riskPenalty(droughtRiskLevel);
  if (droughtRiskLevel !== "none") {
    stressItems.push({
      label: "Drought Stress",
      sublabel: precipitationDeficit > 1.5
        ? `${precipitationDeficit.toFixed(1)}" below average — significant moisture deficit`
        : "Below-average precipitation may limit yield",
      penalty: droughtPenalty,
      level: droughtRiskLevel,
    });
  }

  const harvestPenalty = riskPenalty(harvestDisruptionRiskLevel);
  if (harvestDisruptionRiskLevel !== "none") {
    stressItems.push({
      label: "Harvest Disruption",
      sublabel: "Heavy rain events may delay field operations or reduce quality",
      penalty: harvestPenalty,
      level: harvestDisruptionRiskLevel,
    });
  }

  // Extra critical-event surcharge (each additional critical event beyond 1 adds 3%)
  const extraCriticalPenalty = criticalEventCount > 1
    ? Math.min(0.12, (criticalEventCount - 1) * 0.03)
    : 0;
  if (extraCriticalPenalty > 0) {
    stressItems.push({
      label: "Multiple Extreme Events",
      sublabel: `${criticalEventCount} critical weather events in the 15-day outlook`,
      penalty: extraCriticalPenalty,
      level: "critical",
    });
  }

  // Combined stress penalty (multiplicative cap at 40%)
  const rawPenalty = stressItems.reduce((sum, s) => sum + s.penalty, 0);
  const totalStressPenalty = Math.min(0.40, rawPenalty);

  // ── Yield range ───────────────────────────────────────────────────────────

  // Band reflects stage-based uncertainty — it narrows as the season progresses
  const stressedBaseline = baseline * (1 - totalStressPenalty);
  const halfBand = stressedBaseline * conf.band;

  const rawLow = Math.max(profile.low * 0.8, stressedBaseline - halfBand);
  const rawHigh = Math.min(profile.high * 1.05, stressedBaseline + halfBand);

  const estimatedLow = Math.round(rawLow);
  const estimatedHigh = Math.round(rawHigh);

  const confidence = confidenceFromBand(conf.band);
  const earlyEstimate = currentStageIndex === 0;

  return {
    profile,
    estimatedLow,
    estimatedHigh,
    baseline,
    totalStressPenalty,
    stressItems,
    confidence,
    confidenceLabel: conf.label,
    earlyEstimate,
    isGeneric,
  };
}
