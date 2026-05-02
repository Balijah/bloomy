/**
 * Client-side soil health score computation.
 *
 * Derives a 0–100 composite score from fields already present in the
 * GetAgricultureInsightsResponse — no additional API calls required.
 *
 * Three independent factors are scored and combined:
 *  1. Moisture balance   — precipitation deficit vs average
 *  2. Soil moisture      — direct volumetric reading (when available)
 *  3. ET water demand    — evapotranspiration vs incoming rainfall this week
 */

// ── Input / output types ──────────────────────────────────────────────────────

export interface SoilHealthInput {
  soilMoisture?: number | null;
  evapotranspiration7Day?: number | null;
  /** 14-day precipitation deficit in inches */
  precipitationDeficit: number;
  /** Sum of expected precipitation over next 7 days in inches */
  precipitationForecast: number;
  droughtRiskLevel: string;
}

export interface SoilHealthFactor {
  key: string;
  name: string;
  /** 0–100 sub-score for this factor */
  score: number;
  label: string;
  description: string;
  /** Whether sensor data was available (false = estimated) */
  measured: boolean;
}

export interface SoilHealthResult {
  /** 0–100 composite score */
  score: number;
  label: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  /** Hex color for this score tier */
  color: string;
  /** Short direction — used in the farm card pill */
  trend: "optimal" | "moderate" | "stressed" | "critical";
  /** Breakdown of the three contributing factors */
  factors: SoilHealthFactor[];
}

// ── Score thresholds ──────────────────────────────────────────────────────────

const TIERS = [
  { min: 80, label: "Excellent" as const, color: "#2D7A3A", trend: "optimal" as const },
  { min: 60, label: "Good"      as const, color: "#4D8A5E", trend: "optimal" as const },
  { min: 40, label: "Fair"      as const, color: "#C07820", trend: "moderate" as const },
  { min: 20, label: "Poor"      as const, color: "#D05820", trend: "stressed" as const },
  { min: 0,  label: "Critical"  as const, color: "#D03020", trend: "critical" as const },
] as const;

function tierFor(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

function factorLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Critical";
}

// ── Factor computations ───────────────────────────────────────────────────────

/**
 * Factor 1 — Moisture balance.
 * Scores based on the 14-day precipitation deficit.
 * 0 deficit = 100; larger deficit = lower score.
 */
function scoreMoistureBalance(
  precipDeficit: number,
  droughtRiskLevel: string
): SoilHealthFactor {
  let score = 100;
  score -= Math.min(40, precipDeficit * 16);

  // Extra penalty for confirmed drought risk
  if (droughtRiskLevel === "critical") score -= 20;
  else if (droughtRiskLevel === "high") score -= 10;
  else if (droughtRiskLevel === "moderate") score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const description =
    precipDeficit <= 0.1
      ? "Precipitation is on track — no moisture deficit detected."
      : precipDeficit <= 0.5
      ? `Slight deficit of ${precipDeficit.toFixed(1)}" below 14-day average.`
      : precipDeficit <= 1.5
      ? `Notable deficit of ${precipDeficit.toFixed(1)}" — consider supplemental irrigation.`
      : `Significant deficit of ${precipDeficit.toFixed(1)}" — soil moisture is under pressure.`;

  return {
    key: "moisture_balance",
    name: "Moisture Balance",
    score,
    label: factorLabel(score),
    description,
    measured: false,
  };
}

/**
 * Factor 2 — Soil moisture sensor.
 * Uses the Open-Meteo volumetric soil moisture (m³/m³) at 0–1 cm depth.
 * Optimal range: 0.20–0.45 m³/m³.
 * Returns null if the value is unavailable (sensor returns null often in dry regions).
 */
function scoreSoilMoisture(soilMoisture: number | null | undefined): SoilHealthFactor | null {
  if (soilMoisture == null) return null;

  let score: number;
  let description: string;

  if (soilMoisture < 0.06) {
    score = 5;
    description = `Critically dry at ${(soilMoisture * 100).toFixed(0)}% — well below wilting point.`;
  } else if (soilMoisture < 0.12) {
    score = 20;
    description = `Very low moisture at ${(soilMoisture * 100).toFixed(0)}% — approaching wilting point.`;
  } else if (soilMoisture < 0.20) {
    score = 45;
    description = `Below optimal at ${(soilMoisture * 100).toFixed(0)}% — plants may be under mild stress.`;
  } else if (soilMoisture <= 0.45) {
    score = 90;
    description = `Optimal range at ${(soilMoisture * 100).toFixed(0)}% — soil moisture is in the productive zone.`;
  } else if (soilMoisture <= 0.55) {
    score = 65;
    description = `Elevated at ${(soilMoisture * 100).toFixed(0)}% — soil is on the wetter side; watch for runoff or disease.`;
  } else {
    score = 35;
    description = `Saturated at ${(soilMoisture * 100).toFixed(0)}% — risk of anaerobic conditions and root damage.`;
  }

  return {
    key: "soil_moisture",
    name: "Soil Moisture",
    score: Math.round(score),
    label: factorLabel(score),
    description,
    measured: true,
  };
}

/**
 * Factor 3 — ET demand vs incoming rainfall.
 * Compares 7-day evapotranspiration (inches equivalent) to 7-day rainfall.
 * A balanced ratio ≈ 1.0 is neutral; higher ET than rainfall = water stress.
 */
function scoreETBalance(
  et7Day: number | null | undefined,
  precip7Day: number
): SoilHealthFactor {
  if (!et7Day || et7Day <= 0) {
    return {
      key: "et_balance",
      name: "ET / Rainfall Balance",
      score: 70,
      label: "Good",
      description: "Evapotranspiration data unavailable — defaulting to neutral.",
      measured: false,
    };
  }

  const ratio = precip7Day / et7Day; // < 1 means rainfall < ET (stress)
  let score: number;
  let description: string;

  if (ratio >= 1.0) {
    score = 90;
    description = `Rainfall (${precip7Day.toFixed(2)}") matches or exceeds ET demand (${et7Day.toFixed(2)}") — water budget balanced.`;
  } else if (ratio >= 0.75) {
    score = 72;
    description = `Rainfall (${precip7Day.toFixed(2)}") slightly below ET (${et7Day.toFixed(2)}") — mild demand on soil reserves.`;
  } else if (ratio >= 0.5) {
    score = 50;
    description = `Rainfall (${precip7Day.toFixed(2)}") is only ${(ratio * 100).toFixed(0)}% of ET demand (${et7Day.toFixed(2)}") — monitor soil moisture.`;
  } else if (ratio >= 0.25) {
    score = 28;
    description = `Rainfall (${precip7Day.toFixed(2)}") is well below ET (${et7Day.toFixed(2)}") — soil reserves are being drawn down.`;
  } else {
    score = 10;
    description = `Near-zero rainfall vs ${et7Day.toFixed(2)}" ET — significant depletion of soil moisture reserves.`;
  }

  return {
    key: "et_balance",
    name: "ET / Rainfall Balance",
    score: Math.round(score),
    label: factorLabel(score),
    description,
    measured: et7Day != null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeSoilHealth(input: SoilHealthInput): SoilHealthResult {
  const {
    soilMoisture,
    evapotranspiration7Day,
    precipitationDeficit,
    precipitationForecast,
    droughtRiskLevel,
  } = input;

  const f1 = scoreMoistureBalance(precipitationDeficit, droughtRiskLevel);
  const f2 = scoreSoilMoisture(soilMoisture);
  const f3 = scoreETBalance(evapotranspiration7Day, precipitationForecast);

  // Weighted average: moisture balance 40%, soil moisture 35% (or redistributed), ET 25%
  let composite: number;
  if (f2) {
    composite = f1.score * 0.35 + f2.score * 0.40 + f3.score * 0.25;
  } else {
    // No direct moisture reading — weight the other two
    composite = f1.score * 0.60 + f3.score * 0.40;
  }

  const score = Math.max(0, Math.min(100, Math.round(composite)));
  const tier = tierFor(score);

  const factors: SoilHealthFactor[] = [f1, ...(f2 ? [f2] : []), f3];

  return {
    score,
    label: tier.label,
    color: tier.color,
    trend: tier.trend,
    factors,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

/** Icon name (Ionicons) for each trend */
export function soilTrendIcon(
  trend: SoilHealthResult["trend"]
): "checkmark-circle" | "checkmark-circle-outline" | "alert-circle-outline" | "alert-circle" {
  if (trend === "optimal") return "checkmark-circle";
  if (trend === "moderate") return "checkmark-circle-outline";
  if (trend === "stressed") return "alert-circle-outline";
  return "alert-circle";
}
