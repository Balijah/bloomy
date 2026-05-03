/**
 * plantingCalendar.ts
 *
 * Pure computation helpers for planting date tracking, GDD progress toward
 * harvest, and projected harvest date estimation.
 *
 * All inputs come from already-loaded AgricultureInsights + FarmProfile data —
 * no additional API calls required.
 */

import { getStagesForCrop } from "@/lib/cropStages";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlantingCalendarResult {
  /** Days elapsed since the recorded planting date (null if no planting date) */
  daysSincePlanting: number | null;
  /** Planting date parsed as a JS Date (null if not set) */
  plantingDateObj: Date | null;
  /** Expected harvest date parsed as a JS Date (null if not recorded) */
  harvestDateObj: Date | null;
  /** Total GDD required to reach the harvest stage for this crop */
  harvestGDD: number;
  /** Fraction [0, 1] of the harvest GDD that has been accumulated */
  gddProgress: number;
  /** Remaining GDD needed to reach harvest (0 if already past threshold) */
  remainingGDD: number;
  /** Estimated days from today until harvest GDD threshold is reached */
  projectedDaysToHarvest: number | null;
  /** Projected calendar date of harvest (null if rate is unknown) */
  projectedHarvestDate: Date | null;
  /** Average daily GDD accumulation based on the 15-day forecast */
  dailyGDDRate: number | null;
  /** Whether the accumulated GDD has already passed the harvest threshold */
  harvestWindowReached: boolean;
  /** Whether the user has entered a planting date */
  hasPlantingDate: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLocalDate(dateStr: string): Date {
  // Parse "YYYY-MM-DD" as local midnight to avoid timezone shifts
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Returns the `gddMax` of the last stage — the GDD target for harvest */
function getHarvestGDD(cropType: string): number {
  const stages = getStagesForCrop(cropType);
  return stages[stages.length - 1]?.gddMax ?? 1500;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computePlantingCalendar({
  cropType,
  plantingDate,
  harvestDate,
  accumulatedGDD,
  growingDegreeDaysForecast,
}: {
  cropType: string;
  plantingDate?: string | null;
  harvestDate?: string | null;
  accumulatedGDD?: number | null;
  /** 15-day total GDD forecast from AgricultureInsights */
  growingDegreeDaysForecast: number;
}): PlantingCalendarResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasPlantingDate = !!plantingDate;

  const plantingDateObj = plantingDate ? parseLocalDate(plantingDate) : null;
  const harvestDateObj = harvestDate ? parseLocalDate(harvestDate) : null;

  const daysSincePlanting = plantingDateObj
    ? Math.floor((today.getTime() - plantingDateObj.getTime()) / 86_400_000)
    : null;

  const harvestGDD = getHarvestGDD(cropType);
  const accumulated = accumulatedGDD ?? 0;

  const harvestWindowReached = accumulated >= harvestGDD;
  const gddProgress = Math.min(1, accumulated / harvestGDD);
  const remainingGDD = Math.max(0, harvestGDD - accumulated);

  // Daily GDD rate from the 15-day forecast
  const dailyGDDRate = growingDegreeDaysForecast > 0
    ? growingDegreeDaysForecast / 15
    : null;

  let projectedDaysToHarvest: number | null = null;
  let projectedHarvestDate: Date | null = null;

  if (harvestWindowReached) {
    projectedDaysToHarvest = 0;
    projectedHarvestDate = today;
  } else if (dailyGDDRate != null && dailyGDDRate > 0) {
    projectedDaysToHarvest = Math.round(remainingGDD / dailyGDDRate);
    projectedHarvestDate = new Date(today);
    projectedHarvestDate.setDate(today.getDate() + projectedDaysToHarvest);
  }

  return {
    daysSincePlanting,
    plantingDateObj,
    harvestDateObj,
    harvestGDD,
    gddProgress,
    remainingGDD,
    projectedDaysToHarvest,
    projectedHarvestDate,
    dailyGDDRate,
    harvestWindowReached,
    hasPlantingDate,
  };
}

// ── Formatting helpers (used by UI) ───────────────────────────────────────────

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
