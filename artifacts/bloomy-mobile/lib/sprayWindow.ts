/**
 * Spray window assessment.
 *
 * Combines the 7-day wind, temperature, and precipitation daily arrays
 * already present in AgricultureInsights to rate each day's suitability
 * for pesticide, herbicide, or foliar fertiliser application.
 *
 * Criteria are based on standard agronomic guidelines:
 *  - Wind: 3–10 mph ideal, 2–15 acceptable, >20 or <1 = drift / inversion risk
 *  - Temperature: 50–85°F ideal; <32°F freezing; >90°F volatilisation concern
 *  - Precipitation: < 0.05" and < 25% probability = ideal; > 0.1" or > 60% prob = avoid
 *
 * No additional API calls are needed.
 */

import type {
  AgricultureInsightsDailyWind,
  AgricultureInsightsDailyTemp,
  AgricultureInsightsDailyPrecip,
} from "@workspace/api-client-react";

// ── Rating tiers ──────────────────────────────────────────────────────────────

export type SprayRating = "ideal" | "good" | "marginal" | "poor" | "avoid";

export interface SprayDayResult {
  date: string;
  /** Short day-of-week label, e.g. "Mon" */
  dayLabel: string;
  /** Formatted date label, e.g. "May 3" */
  dateLabel: string;
  rating: SprayRating;
  ratingLabel: string;
  /** Hex colour for this rating */
  color: string;
  /** Primary limiting factor, if any */
  limitingFactor: string | null;
  /** Short status sentence for tooltip / detail row */
  summary: string;
  /** Resolved daily values used in scoring */
  wind: number;
  tempMax: number;
  tempMin: number;
  precipInches: number;
  precipProbability: number;
}

export interface SprayWindowResult {
  days: SprayDayResult[];
  /** Count of days rated ideal or good */
  goodWindowCount: number;
  /** Index of the first ideal/good day; null if none */
  nextGoodWindowIndex: number | null;
  /** Overall week outlook sentence */
  weekSummary: string;
}

// ── Colours ───────────────────────────────────────────────────────────────────

const RATING_COLORS: Record<SprayRating, string> = {
  ideal:    "#2D7A3A",
  good:     "#4D8A5E",
  marginal: "#C07820",
  poor:     "#D05820",
  avoid:    "#D03020",
};

const RATING_LABELS: Record<SprayRating, string> = {
  ideal:    "Ideal",
  good:     "Good",
  marginal: "Marginal",
  poor:     "Poor",
  avoid:    "Avoid",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDateLabels(iso: string): { dayLabel: string; dateLabel: string } {
  // Parse YYYY-MM-DD safely without timezone shift
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return {
    dayLabel: SHORT_DAYS[d.getDay()],
    dateLabel: `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`,
  };
}

// ── Per-day scorer ────────────────────────────────────────────────────────────

function scoreDay(
  date: string,
  wind: number,
  tempMax: number,
  tempMin: number,
  precipInches: number,
  precipProbability: number,
): SprayDayResult {
  const { dayLabel, dateLabel } = parseDateLabels(date);

  // ── Hard avoid conditions ────────────────────────────────────────────────
  if (tempMin <= 32) {
    return {
      date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
      rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Freezing temperatures",
      summary: `Low of ${tempMin}°F — product may freeze on surfaces; skip application.`,
    };
  }
  if (wind > 20) {
    return {
      date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
      rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Excessive wind",
      summary: `Wind up to ${wind} mph — significant drift risk; do not spray.`,
    };
  }
  if (precipProbability >= 65 || precipInches >= 0.25) {
    return {
      date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
      rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: precipInches >= 0.25 ? "Rain expected" : "High rain probability",
      summary: precipInches >= 0.25
        ? `${precipInches}" of rain forecast — product will wash off before absorbing.`
        : `${precipProbability}% chance of rain — too risky for application.`,
    };
  }
  if (tempMax >= 95) {
    return {
      date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
      rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Extreme heat",
      summary: `High of ${tempMax}°F — rapid evaporation and volatilisation; defer to evening or cooler day.`,
    };
  }

  // ── Score each factor independently ─────────────────────────────────────
  // Wind score (best: 3–10 mph)
  let windScore: "ideal" | "good" | "marginal" | "poor";
  if (wind >= 3 && wind <= 10) windScore = "ideal";
  else if (wind >= 2 && wind <= 15) windScore = "good";
  else if (wind >= 1 && wind <= 20) windScore = "marginal";
  else windScore = "poor"; // < 1 mph (inversion risk) handled here

  // Temperature score (best: 50–85°F)
  let tempScore: "ideal" | "good" | "marginal" | "poor";
  if (tempMax >= 50 && tempMax <= 85 && tempMin >= 36) tempScore = "ideal";
  else if (tempMax >= 40 && tempMax <= 90 && tempMin >= 33) tempScore = "good";
  else if (tempMax >= 35 && tempMax <= 94) tempScore = "marginal";
  else tempScore = "poor";

  // Precipitation score
  let precipScore: "ideal" | "good" | "marginal" | "poor";
  if (precipInches < 0.05 && precipProbability < 25) precipScore = "ideal";
  else if (precipInches < 0.1 && precipProbability < 40) precipScore = "good";
  else if (precipInches < 0.2 && precipProbability < 60) precipScore = "marginal";
  else precipScore = "poor";

  // Composite: worst of the three scores wins
  const ORDER: Record<string, number> = { ideal: 0, good: 1, marginal: 2, poor: 3 };
  const scores = [windScore, tempScore, precipScore] as const;
  const worstIdx = scores.reduce<number>((acc, s) => Math.max(acc, ORDER[s]), 0);
  const reverseOrder = ["ideal", "good", "marginal", "poor"] as const;
  const rating = reverseOrder[worstIdx];

  // Limiting factor label
  const limiters: string[] = [];
  if (windScore === "poor" || windScore === "marginal") {
    limiters.push(wind < 2 ? "Calm — inversion risk" : `Wind ${wind} mph`);
  }
  if (tempScore === "poor" || tempScore === "marginal") {
    limiters.push(tempMax >= 90 ? `High temp ${tempMax}°F` : `Cool temp ${tempMin}°F`);
  }
  if (precipScore === "poor" || precipScore === "marginal") {
    limiters.push(precipProbability > 20 ? `${precipProbability}% rain chance` : `${precipInches}" rain`);
  }
  const limitingFactor = limiters.length > 0 ? limiters.join("; ") : null;

  // Summary sentence
  let summary: string;
  if (rating === "ideal") {
    summary = `Excellent conditions — ${wind} mph wind, ${tempMax}°F high, ${precipProbability}% rain chance.`;
  } else if (rating === "good") {
    summary = `Good window — ${limitingFactor ? `note: ${limitingFactor.toLowerCase()}.` : `${wind} mph wind, ${tempMax}°F high.`}`;
  } else if (rating === "marginal") {
    summary = `Marginal — ${limitingFactor ?? "conditions not ideal"}. Spray only if necessary.`;
  } else {
    summary = `Poor — ${limitingFactor ?? "multiple factors unfavourable"}. Consider postponing.`;
  }

  return {
    date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
    rating: rating as SprayRating,
    ratingLabel: RATING_LABELS[rating as SprayRating],
    color: RATING_COLORS[rating as SprayRating],
    limitingFactor,
    summary,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeSprayWindows(
  windDaily: AgricultureInsightsDailyWind[] | undefined,
  temperatureDaily: AgricultureInsightsDailyTemp[] | undefined,
  precipitationDaily: AgricultureInsightsDailyPrecip[] | undefined,
): SprayWindowResult {
  // Build a date-keyed map to safely merge the three arrays
  const windMap: Record<string, number> = {};
  windDaily?.forEach((w) => { windMap[w.date] = w.windSpeedMax; });

  const tempMap: Record<string, { max: number; min: number }> = {};
  temperatureDaily?.forEach((t) => { tempMap[t.date] = { max: t.tempMax, min: t.tempMin }; });

  const precipMap: Record<string, { inches: number; prob: number }> = {};
  precipitationDaily?.forEach((p) => { precipMap[p.date] = { inches: p.precipitation, prob: p.precipitationProbability }; });

  // Use the temperature array as the anchor (always present)
  const dates = temperatureDaily?.map((t) => t.date) ?? Object.keys(windMap);

  const days: SprayDayResult[] = dates.map((date) => {
    const wind = windMap[date] ?? 5;
    const temp = tempMap[date] ?? { max: 70, min: 50 };
    const precip = precipMap[date] ?? { inches: 0, prob: 0 };
    return scoreDay(date, wind, temp.max, temp.min, precip.inches, precip.prob);
  });

  const goodWindowCount = days.filter(
    (d) => d.rating === "ideal" || d.rating === "good"
  ).length;

  const nextGoodWindowIndex =
    days.findIndex((d) => d.rating === "ideal" || d.rating === "good") ?? null;

  let weekSummary: string;
  if (goodWindowCount === 0) {
    weekSummary = "No suitable spray windows in the next 7 days — plan around next week's forecast.";
  } else if (goodWindowCount >= 5) {
    weekSummary = `Excellent week for applications — ${goodWindowCount} of 7 days are suitable.`;
  } else if (goodWindowCount >= 3) {
    weekSummary = `${goodWindowCount} good spray windows this week. Target the ideal days early.`;
  } else {
    weekSummary = `Only ${goodWindowCount} spray window${goodWindowCount > 1 ? "s" : ""} this week — prioritise your most critical applications.`;
  }

  return { days, goodWindowCount, nextGoodWindowIndex: nextGoodWindowIndex === -1 ? null : nextGoodWindowIndex, weekSummary };
}
