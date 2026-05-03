/**
 * Spray window assessment — enhanced with:
 *   • Application type-specific thresholds (herbicide / pre-emergent / pesticide / foliar)
 *   • Humidity scoring factor
 *   • Temperature inversion detection (calm wind + cooling trend)
 *   • Hourly slot scoring from HourlyForecast data
 *
 * Daily scoring uses 7-day arrays already in AgricultureInsights.
 * Hourly scoring uses the /weather/hourly 48-hr endpoint (paid tier — gracefully absent).
 */

import type {
  AgricultureInsightsDailyWind,
  AgricultureInsightsDailyTemp,
  AgricultureInsightsDailyPrecip,
  HourlyForecast,
} from "@workspace/api-client-react";

// ── Spray type ────────────────────────────────────────────────────────────────

export type SprayType = "herbicide" | "preEmergent" | "pesticide" | "foliar";

export interface SprayTypeInfo {
  key: SprayType;
  label: string;
  icon: string;
  description: string;
  humidityIdeal: [number, number];
  humidityOk: [number, number];
  windIdeal: [number, number];
  windOk: [number, number];
  tempIdeal: [number, number];
  tempOk: [number, number];
  rainFreeHours: number;
  tip: string;
}

export const SPRAY_TYPES: SprayTypeInfo[] = [
  {
    key: "herbicide",
    label: "Herbicide",
    icon: "leaf-outline",
    description: "Systemic & contact weed control",
    humidityIdeal: [40, 80],
    humidityOk:    [30, 90],
    windIdeal:     [3, 10],
    windOk:        [2, 15],
    tempIdeal:     [55, 85],
    tempOk:        [45, 90],
    rainFreeHours: 4,
    tip: "Apply mid-morning when humidity is rising but dew has dried. Avoid midday heat.",
  },
  {
    key: "preEmergent",
    label: "Pre-Emergent",
    icon: "earth-outline",
    description: "Soil-applied residual herbicide",
    humidityIdeal: [30, 85],
    humidityOk:    [20, 95],
    windIdeal:     [1, 15],
    windOk:        [1, 20],
    tempIdeal:     [40, 85],
    tempOk:        [35, 90],
    rainFreeHours: 0,
    tip: "Needs ½\" rain within 7–14 days for incorporation. Wind less critical than for foliar.",
  },
  {
    key: "pesticide",
    label: "Pesticide",
    icon: "bug-outline",
    description: "Insecticide & fungicide",
    humidityIdeal: [40, 85],
    humidityOk:    [30, 90],
    windIdeal:     [3, 10],
    windOk:        [2, 15],
    tempIdeal:     [50, 80],
    tempOk:        [45, 88],
    rainFreeHours: 2,
    tip: "Target insects when active (above 50°F). Avoid high heat — reduces product efficacy.",
  },
  {
    key: "foliar",
    label: "Foliar Feed",
    icon: "nutrition-outline",
    description: "Foliar fertilizer & micronutrients",
    humidityIdeal: [60, 90],
    humidityOk:    [50, 95],
    windIdeal:     [2, 8],
    windOk:        [1, 12],
    tempIdeal:     [50, 80],
    tempOk:        [45, 85],
    rainFreeHours: 6,
    tip: "Stomata most open in cool, humid mornings. High humidity maximises foliar uptake.",
  },
];

export function getSprayTypeInfo(type: SprayType): SprayTypeInfo {
  return SPRAY_TYPES.find((s) => s.key === type)!;
}

// ── Rating tiers ──────────────────────────────────────────────────────────────

export type SprayRating = "ideal" | "good" | "marginal" | "poor" | "avoid";

const RATING_ORDER: Record<SprayRating, number> = {
  ideal: 0, good: 1, marginal: 2, poor: 3, avoid: 4,
};
const RATING_KEYS: SprayRating[] = ["ideal", "good", "marginal", "poor", "avoid"];

export const RATING_COLORS: Record<SprayRating, string> = {
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

function worstRating(ratings: SprayRating[]): SprayRating {
  const idx = ratings.reduce((acc, r) => Math.max(acc, RATING_ORDER[r]), 0);
  return RATING_KEYS[idx];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const SHORT_DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDateLabels(iso: string): { dayLabel: string; dateLabel: string } {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return {
    dayLabel:  SHORT_DAYS[d.getDay()],
    dateLabel: `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`,
  };
}

export function isoDate(dt: string | Date): string {
  const s = typeof dt === "string" ? dt : dt.toISOString();
  return s.slice(0, 10);
}

export function hourOf(dt: string | Date): number {
  const s = typeof dt === "string" ? dt : dt.toISOString();
  return parseInt(s.slice(11, 13), 10);
}

// ── Per-factor scorers ────────────────────────────────────────────────────────

function scoreWind(mph: number, info: SprayTypeInfo): SprayRating {
  if (mph > 20)                          return "avoid";
  const [iMin, iMax] = info.windIdeal;
  const [oMin, oMax] = info.windOk;
  if (mph >= iMin && mph <= iMax)        return "ideal";
  if (mph >= oMin && mph <= oMax)        return "good";
  if (mph >= 1 && mph <= 20)             return "marginal";
  return "poor";
}

function scoreTemp(max: number, min: number, info: SprayTypeInfo): SprayRating {
  if (min <= 32 || max >= 95)            return "avoid";
  const [iMin, iMax] = info.tempIdeal;
  const [oMin, oMax] = info.tempOk;
  if (max >= iMin && max <= iMax && min >= iMin - 15) return "ideal";
  if (max >= oMin && max <= oMax)        return "good";
  if (max >= oMin - 5 && max <= oMax + 4) return "marginal";
  return "poor";
}

function scoreHumidity(rh: number | null, info: SprayTypeInfo): SprayRating {
  if (rh == null)                        return "good"; // unknown = don't penalise
  const [iMin, iMax] = info.humidityIdeal;
  const [oMin, oMax] = info.humidityOk;
  if (rh >= iMin && rh <= iMax)          return "ideal";
  if (rh >= oMin && rh <= oMax)          return "good";
  if (rh >= oMin - 10 && rh <= oMax + 5) return "marginal";
  return "poor";
}

function scorePrecip(inches: number, prob: number): SprayRating {
  if (prob >= 65 || inches >= 0.25)      return "avoid";
  if (inches < 0.05 && prob < 25)        return "ideal";
  if (inches < 0.1  && prob < 40)        return "good";
  if (inches < 0.2  && prob < 60)        return "marginal";
  return "poor";
}

// ── Daily SprayDayResult ──────────────────────────────────────────────────────

export interface SprayDayResult {
  date: string;
  dayLabel:    string;
  dateLabel:   string;
  rating:      SprayRating;
  ratingLabel: string;
  color:       string;
  limitingFactor: string | null;
  summary:        string;
  wind:              number;
  tempMax:           number;
  tempMin:           number;
  precipInches:      number;
  precipProbability: number;
  humidity:     number | null;
  inversionRisk: boolean;
}

export interface SprayWindowResult {
  days:                SprayDayResult[];
  goodWindowCount:     number;
  nextGoodWindowIndex: number | null;
  weekSummary:         string;
}

function buildDaySummary(
  rating: SprayRating,
  wind: number,
  tempMax: number,
  limitingFactor: string | null,
  type: SprayTypeInfo,
): string {
  if (rating === "ideal")    return `Excellent — ${wind} mph wind, ${tempMax}°F high. Great window for ${type.label.toLowerCase()}.`;
  if (rating === "good")     return limitingFactor ? `Good window — note: ${limitingFactor.toLowerCase()}.` : `Good conditions for ${type.label.toLowerCase()}.`;
  if (rating === "marginal") return `Marginal — ${limitingFactor ?? "conditions not ideal"}. Apply only if necessary.`;
  if (rating === "poor")     return `Poor — ${limitingFactor ?? "multiple factors unfavourable"}. Consider postponing.`;
  return `Avoid — ${limitingFactor ?? "conditions unsafe for application"}.`;
}

function scoreDay(
  date: string,
  wind: number,
  tempMax: number,
  tempMin: number,
  precipInches: number,
  precipProbability: number,
  humidity: number | null,
  type: SprayTypeInfo,
): SprayDayResult {
  const { dayLabel, dateLabel } = parseDateLabels(date);
  const inversionRisk = wind < 2;

  if (tempMin <= 32) {
    return { date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability, humidity,
      inversionRisk: false, rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Freezing temperatures",
      summary: `Low of ${tempMin}°F — product may freeze on surfaces; skip application.` };
  }
  if (wind > 20) {
    return { date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability, humidity,
      inversionRisk: false, rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Excessive wind",
      summary: `Wind up to ${wind} mph — significant drift risk; do not spray.` };
  }
  if (precipProbability >= 65 || precipInches >= 0.25) {
    const lf = precipInches >= 0.25 ? "Rain expected" : "High rain probability";
    return { date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability, humidity,
      inversionRisk: false, rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: lf,
      summary: precipInches >= 0.25
        ? `${precipInches}" rain forecast — product washes off before absorbing.`
        : `${precipProbability}% rain chance — too risky for ${type.label.toLowerCase()}.` };
  }
  if (tempMax >= 95) {
    return { date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability, humidity,
      inversionRisk: false, rating: "avoid", ratingLabel: "Avoid", color: RATING_COLORS.avoid,
      limitingFactor: "Extreme heat",
      summary: `High of ${tempMax}°F — volatilisation risk; defer to cooler conditions.` };
  }

  const wScore = scoreWind(wind, type);
  const tScore = scoreTemp(tempMax, tempMin, type);
  const hScore = scoreHumidity(humidity, type);
  const pScore = scorePrecip(precipInches, precipProbability);

  const composite = type.key === "preEmergent"
    ? worstRating([tScore, pScore])
    : worstRating([wScore, tScore, hScore, pScore]);

  const limiters: string[] = [];
  if (inversionRisk)                                            limiters.push("Calm wind — inversion risk");
  if (wScore === "poor" || wScore === "marginal")               limiters.push(`Wind ${wind} mph`);
  if (tScore === "poor" || tScore === "marginal")               limiters.push(tempMax >= 90 ? `High ${tempMax}°F` : `Cool ${tempMin}°F`);
  if ((hScore === "poor" || hScore === "marginal") && humidity != null) {
    const [iMin] = type.humidityIdeal;
    limiters.push(humidity < iMin ? `Low humidity ${humidity}%` : `High humidity ${humidity}%`);
  }
  if (pScore === "poor" || pScore === "marginal")               limiters.push(precipProbability > 20 ? `${precipProbability}% rain` : `${precipInches}" rain`);

  const limitingFactor = limiters.length > 0 ? limiters.join("; ") : null;
  const rating = inversionRisk && composite === "ideal" ? "good" : composite;

  return {
    date, dayLabel, dateLabel, wind, tempMax, tempMin, precipInches, precipProbability,
    humidity, inversionRisk, rating, ratingLabel: RATING_LABELS[rating],
    color: RATING_COLORS[rating], limitingFactor,
    summary: buildDaySummary(rating, wind, tempMax, limitingFactor, type),
  };
}

// ── Hourly slot scoring ───────────────────────────────────────────────────────

export interface HourlySlot {
  time:  string;
  hour:  number;
  label: string;
  temperature:          number;
  windSpeed:            number;
  humidity:             number;
  precipitationProbability: number;
  isDay:        boolean;
  rating:       SprayRating;
  color:        string;
  inversionRisk: boolean;
  note:         string | null;
}

function hourLabel(h: number): string {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function scoreHourlySlot(fc: HourlyForecast, type: SprayTypeInfo): HourlySlot {
  const time  = typeof fc.time === "string" ? fc.time : (fc.time as Date).toISOString();
  const hour  = hourOf(time);
  const label = hourLabel(hour);

  const wind = fc.windSpeed;
  const temp = fc.temperature;
  const rh   = fc.humidity;
  const pp   = fc.precipitationProbability;
  const prec = fc.precipitation;

  const hardAvoid = temp <= 32 || wind > 20 || pp >= 65 || prec >= 0.15;
  const inversionRisk = wind < 2 && !fc.isDay;

  if (hardAvoid) {
    const note = temp <= 32 ? "Freezing" : wind > 20 ? `${wind} mph wind` : `${pp}% rain`;
    return { time, hour, label, temperature: temp, windSpeed: wind, humidity: rh,
      precipitationProbability: pp, isDay: fc.isDay,
      rating: "avoid", color: RATING_COLORS.avoid, inversionRisk, note };
  }

  const wScore = scoreWind(wind, type);
  const tScore = scoreTemp(temp, temp - 5, type);
  const hScore = scoreHumidity(rh, type);
  const pScore: SprayRating = pp < 25 ? "ideal" : pp < 40 ? "good" : pp < 60 ? "marginal" : "poor";

  const composite = type.key === "preEmergent"
    ? worstRating([tScore, pScore])
    : worstRating([wScore, tScore, hScore, pScore]);

  const rating = inversionRisk && composite === "ideal" ? "good" : composite;

  const notes: string[] = [];
  if (inversionRisk)                             notes.push("Inversion risk");
  if (wScore === "marginal" || wScore === "poor") notes.push(`Wind ${wind} mph`);
  if (hScore === "marginal" || hScore === "poor") {
    const [iMin] = type.humidityIdeal;
    notes.push(rh < iMin ? `Low RH ${rh}%` : `High RH ${rh}%`);
  }
  if (tScore === "marginal" || tScore === "poor") notes.push(`${Math.round(temp)}°F`);

  return { time, hour, label, temperature: temp, windSpeed: wind, humidity: rh,
    precipitationProbability: pp, isDay: fc.isDay,
    rating, color: RATING_COLORS[rating], inversionRisk, note: notes[0] ?? null };
}

/** Score daytime slots (5 AM – 7 PM) for one specific date. */
export function computeHourlySlots(
  hourlyData: HourlyForecast[],
  date: string,
  type: SprayType,
): HourlySlot[] {
  const info = getSprayTypeInfo(type);
  return hourlyData
    .filter((fc) => isoDate(fc.time) === date && hourOf(fc.time) >= 5 && hourOf(fc.time) <= 19)
    .map((fc) => scoreHourlySlot(fc, info));
}

/** Return the consecutive run of ideal/good slots with the best composite score. */
export function findBestHourlyWindow(slots: HourlySlot[]): HourlySlot[] {
  if (!slots.length) return [];
  const good = slots.filter((s) => s.rating === "ideal" || s.rating === "good");
  if (!good.length) return [];

  const groups: HourlySlot[][] = [];
  let cur: HourlySlot[] = [good[0]];
  for (let i = 1; i < good.length; i++) {
    if (good[i].hour - good[i - 1].hour <= 2) cur.push(good[i]);
    else { groups.push(cur); cur = [good[i]]; }
  }
  groups.push(cur);

  return groups.reduce((best, g) => {
    const scoreG = g.filter((s) => s.rating === "ideal").length * 2 + g.length;
    const scoreB = best.filter((s) => s.rating === "ideal").length * 2 + best.length;
    return scoreG >= scoreB ? g : best;
  }, groups[0]);
}

// ── Main daily export ─────────────────────────────────────────────────────────

export function computeSprayWindows(
  windDaily:         AgricultureInsightsDailyWind[]   | undefined,
  temperatureDaily:  AgricultureInsightsDailyTemp[]   | undefined,
  precipitationDaily: AgricultureInsightsDailyPrecip[] | undefined,
  hourlyData?: HourlyForecast[],
  sprayType: SprayType = "herbicide",
): SprayWindowResult {
  const typeInfo = getSprayTypeInfo(sprayType);

  const windMap: Record<string, number> = {};
  windDaily?.forEach((w) => { windMap[w.date] = w.windSpeedMax; });

  const tempMap: Record<string, { max: number; min: number }> = {};
  temperatureDaily?.forEach((t) => { tempMap[t.date] = { max: t.tempMax, min: t.tempMin }; });

  const precipMap: Record<string, { inches: number; prob: number }> = {};
  precipitationDaily?.forEach((p) => { precipMap[p.date] = { inches: p.precipitation, prob: p.precipitationProbability }; });

  // Derive daily avg humidity (daytime 6–18) from hourly data if available
  const humidityMap: Record<string, number | null> = {};
  if (hourlyData?.length) {
    const groups: Record<string, number[]> = {};
    hourlyData.forEach((fc) => {
      const d = isoDate(fc.time);
      const h = hourOf(fc.time);
      if (h >= 6 && h <= 18) (groups[d] = groups[d] ?? []).push(fc.humidity);
    });
    for (const [d, rhs] of Object.entries(groups)) {
      humidityMap[d] = Math.round(rhs.reduce((s, v) => s + v, 0) / rhs.length);
    }
  }

  const dates = temperatureDaily?.map((t) => t.date) ?? Object.keys(windMap);

  const days = dates.map((date) => scoreDay(
    date,
    windMap[date]   ?? 5,
    tempMap[date]?.max ?? 70,
    tempMap[date]?.min ?? 50,
    precipMap[date]?.inches ?? 0,
    precipMap[date]?.prob   ?? 0,
    humidityMap[date] ?? null,
    typeInfo,
  ));

  const goodWindowCount     = days.filter((d) => d.rating === "ideal" || d.rating === "good").length;
  const rawIdx              = days.findIndex((d) => d.rating === "ideal" || d.rating === "good");
  const nextGoodWindowIndex = rawIdx === -1 ? null : rawIdx;

  const weekSummary =
    goodWindowCount === 0
      ? `No suitable ${typeInfo.label.toLowerCase()} windows in the next 7 days.`
      : goodWindowCount >= 5
      ? `Excellent week — ${goodWindowCount} of 7 days suit ${typeInfo.label.toLowerCase()}.`
      : goodWindowCount >= 3
      ? `${goodWindowCount} good ${typeInfo.label.toLowerCase()} windows. Target ideal days early.`
      : `Only ${goodWindowCount} window${goodWindowCount > 1 ? "s" : ""} this week — prioritise critical applications.`;

  return { days, goodWindowCount, nextGoodWindowIndex, weekSummary };
}
