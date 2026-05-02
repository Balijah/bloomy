/**
 * Client-side frost risk / harvest countdown computation.
 *
 * Derives:
 *  - Days until next expected frost (from insights.nextFrostDate)
 *  - Estimated days until harvest (from accumulated GDD vs crop maturity threshold)
 *  - A status tier: safe | monitor | at_risk | critical | no_frost | harvested
 *
 * No additional API calls — all inputs come from the already-loaded
 * AgricultureInsights response.
 */

// ── Crop harvest GDD thresholds ───────────────────────────────────────────────
// The GDD value at which each crop reaches its final (harvest/maturity) stage.

const HARVEST_GDD: Record<string, number> = {
  corn: 1600,
  soybeans: 1200,
  winter_wheat: 900,
  cotton: 1200,
  almonds: 900,
  grapes: 900,
  apples: 900,
  potatoes: 1100,
  rice: 1200,
  other: 900,
};

// Average GDD per day assumed when no forecast data is available.
const DEFAULT_DAILY_GDD = 14;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FrostStatus =
  | "safe"       // frost well after projected harvest
  | "monitor"    // frost within 15–30 days of harvest
  | "at_risk"    // frost within 14 days of harvest
  | "critical"   // frost before estimated harvest
  | "no_frost"   // no frost date in forecast window
  | "harvested"; // crop already at/past physiological maturity

export interface FrostRiskResult {
  /** Calendar days until next frost; null when no frost is forecast */
  daysToFrost: number | null;
  /** The frost date as a Date object; null when no frost is forecast */
  frostDate: Date | null;
  /** Estimated calendar days until harvest; null when GDD data is unavailable */
  harvestDaysEstimate: number | null;
  /** GDD still needed to reach the harvest threshold; null when unavailable */
  gddToHarvest: number | null;
  /** Current status tier */
  status: FrostStatus;
  /** Short human-readable status label */
  statusLabel: string;
  /** Hex colour for the status tier */
  statusColor: string;
  /** One-sentence message explaining the situation */
  message: string;
  /** Concise action recommendation */
  action: string;
}

// ── Status colour map ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FrostStatus, string> = {
  safe:      "#2D7A3A",
  monitor:   "#C07820",
  at_risk:   "#D05820",
  critical:  "#D03020",
  no_frost:  "#4D8A5E",
  harvested: "#5A7A6A",
};

const STATUS_LABELS: Record<FrostStatus, string> = {
  safe:      "Safe",
  monitor:   "Monitor",
  at_risk:   "At Risk",
  critical:  "Critical",
  no_frost:  "No Frost Expected",
  harvested: "Harvest Ready",
};

// ── Main export ───────────────────────────────────────────────────────────────

export interface FrostRiskInput {
  nextFrostDate?: string | null;
  accumulatedGDD?: number | null;
  /** GDD accumulated over the next 15 days (from the forecast) */
  growingDegreeDaysForecast?: number | null;
  cropType: string;
}

export function computeFrostRisk(input: FrostRiskInput): FrostRiskResult {
  const { nextFrostDate, accumulatedGDD, growingDegreeDaysForecast, cropType } = input;

  // ── Frost date ────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let frostDate: Date | null = null;
  let daysToFrost: number | null = null;

  if (nextFrostDate) {
    frostDate = new Date(nextFrostDate);
    frostDate.setHours(0, 0, 0, 0);
    daysToFrost = Math.round(
      (frostDate.getTime() - today.getTime()) / 86400000
    );
    // Negative means frost has already passed; treat as null
    if (daysToFrost < 0) {
      daysToFrost = null;
      frostDate = null;
    }
  }

  // ── Harvest estimate ──────────────────────────────────────────────────────
  const harvestGDD = HARVEST_GDD[cropType] ?? HARVEST_GDD.other;
  let gddToHarvest: number | null = null;
  let harvestDaysEstimate: number | null = null;

  if (accumulatedGDD != null) {
    gddToHarvest = Math.max(0, harvestGDD - accumulatedGDD);

    // Daily GDD rate: use 15-day forecast average or fall back to default
    const dailyGDD =
      growingDegreeDaysForecast != null && growingDegreeDaysForecast > 0
        ? growingDegreeDaysForecast / 15
        : DEFAULT_DAILY_GDD;

    harvestDaysEstimate =
      gddToHarvest <= 0 ? 0 : Math.round(gddToHarvest / dailyGDD);
  }

  // ── Status logic ──────────────────────────────────────────────────────────

  // Crop already at or past maturity
  if (harvestDaysEstimate !== null && harvestDaysEstimate <= 0) {
    return {
      daysToFrost,
      frostDate,
      harvestDaysEstimate: 0,
      gddToHarvest: 0,
      status: "harvested",
      statusLabel: STATUS_LABELS.harvested,
      statusColor: STATUS_COLORS.harvested,
      message: "This crop has reached physiological maturity and is ready for harvest.",
      action: daysToFrost != null && daysToFrost <= 7
        ? "Frost is approaching — complete harvest operations as soon as possible."
        : "Plan harvest logistics and book equipment before the weather window closes.",
    };
  }

  // No frost forecast in the outlook window
  if (daysToFrost === null) {
    const harvestMsg =
      harvestDaysEstimate != null
        ? ` Estimated ${harvestDaysEstimate} days until harvest.`
        : "";
    return {
      daysToFrost: null,
      frostDate: null,
      harvestDaysEstimate,
      gddToHarvest,
      status: "no_frost",
      statusLabel: STATUS_LABELS.no_frost,
      statusColor: STATUS_COLORS.no_frost,
      message: `No frost is expected in the current forecast window.${harvestMsg}`,
      action: "Continue standard growing operations — no frost protection needed at this time.",
    };
  }

  // Determine how much overlap exists between frost and harvest
  if (harvestDaysEstimate === null) {
    // No GDD data — can only show frost countdown
    const status: FrostStatus = daysToFrost <= 7 ? "at_risk" : daysToFrost <= 21 ? "monitor" : "safe";
    return {
      daysToFrost,
      frostDate,
      harvestDaysEstimate: null,
      gddToHarvest: null,
      status,
      statusLabel: STATUS_LABELS[status],
      statusColor: STATUS_COLORS[status],
      message: `Frost is expected in ${daysToFrost} day${daysToFrost !== 1 ? "s" : ""}. Add a planting date to see harvest overlap analysis.`,
      action: status === "safe"
        ? "No immediate action needed. Monitor the outlook as the season progresses."
        : "Consider frost protection options if crops are still actively growing.",
    };
  }

  // Full analysis: frost vs harvest comparison
  const frostBeforeHarvest = daysToFrost < harvestDaysEstimate;
  const gap = harvestDaysEstimate - daysToFrost; // positive = frost before harvest

  let status: FrostStatus;
  let message: string;
  let action: string;

  if (frostBeforeHarvest) {
    // Frost arrives before estimated harvest
    status = "critical";
    message = `Frost is expected ${gap} day${gap !== 1 ? "s" : ""} before your estimated harvest date — the crop is at immediate risk.`;
    action = "Consider early harvest, apply row covers or frost cloth, or use wind machines to protect vulnerable growth stages.";
  } else {
    const margin = daysToFrost - harvestDaysEstimate;
    if (margin <= 7) {
      status = "at_risk";
      message = `Frost arrives just ${margin} day${margin !== 1 ? "s" : ""} after projected harvest — very little buffer remains.`;
      action = "Prioritise timely harvest and have frost protection ready in case conditions deteriorate earlier than forecast.";
    } else if (margin <= 21) {
      status = "monitor";
      message = `Frost is expected about ${margin} days after projected harvest — a moderate buffer exists, but worth watching.`;
      action = "Track the forecast weekly and begin harvest preparations well ahead of the frost window.";
    } else {
      status = "safe";
      message = `Frost arrives ${margin} days after the estimated harvest — the growing season has ample time to complete.`;
      action = "No frost protection needed at this stage. Continue standard crop management.";
    }
  }

  return {
    daysToFrost,
    frostDate,
    harvestDaysEstimate,
    gddToHarvest,
    status,
    statusLabel: STATUS_LABELS[status],
    statusColor: STATUS_COLORS[status],
    message,
    action,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

/** Short month + day label, e.g. "Oct 15" */
export function formatFrostDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Ionicons icon name for each status */
export function frostStatusIcon(status: FrostStatus): string {
  switch (status) {
    case "safe":      return "checkmark-circle";
    case "no_frost":  return "sunny-outline";
    case "harvested": return "checkmark-done-circle";
    case "monitor":   return "alert-circle-outline";
    case "at_risk":   return "alert-circle";
    case "critical":  return "warning";
  }
}
