/**
 * Irrigation scheduling assistant.
 *
 * Runs a day-by-day soil water balance simulation from existing
 * AgricultureInsights fields — no additional API calls.
 *
 * Method (FAO-56 simplified):
 *  - Root zone Available Water Capacity (AWC) = (field capacity − wilting point)
 *    × root depth = 0.25 in/in × rootDepth_in
 *  - Current available water from the soil moisture sensor (if present), or
 *    estimated from precipitation deficit when no sensor is available.
 *  - Each day: deplete by max(0, dailyET − dailyRain); refill by rain surplus.
 *  - Irrigation is triggered when AW falls to MAD (management allowed depletion).
 *  - Recommended depth fills the root zone back to field capacity.
 */

/** Per-day precipitation entry used by the water balance simulation. */
export interface DailyPrecipEntry {
  date: string;
  precipitation: number;
}

// ── Crop parameters ───────────────────────────────────────────────────────────

interface CropIrrigationParams {
  /** Effective root zone depth in inches */
  rootDepthIn: number;
  /** Management Allowed Depletion fraction (0–1). Irrigate when AW < AWC×(1−MAD) */
  mad: number;
  /** True for flood-irrigated rice — shows a special note instead */
  flooded?: boolean;
}

const CROP_PARAMS: Record<string, CropIrrigationParams> = {
  corn:         { rootDepthIn: 24, mad: 0.50 },
  soybeans:     { rootDepthIn: 24, mad: 0.50 },
  winter_wheat: { rootDepthIn: 30, mad: 0.55 },
  cotton:       { rootDepthIn: 36, mad: 0.50 },
  almonds:      { rootDepthIn: 48, mad: 0.50 },
  grapes:       { rootDepthIn: 48, mad: 0.45 },
  apples:       { rootDepthIn: 36, mad: 0.50 },
  potatoes:     { rootDepthIn: 18, mad: 0.35 },
  rice:         { rootDepthIn: 12, mad: 0.30, flooded: true },
  other:        { rootDepthIn: 24, mad: 0.50 },
};

// Soil texture defaults (generic loam)
const WILTING_POINT   = 0.10; // m³/m³ volumetric
const FIELD_CAPACITY  = 0.35; // m³/m³ volumetric
const AWC_PER_INCH    = FIELD_CAPACITY - WILTING_POINT; // 0.25 in/in

// Default daily ET when 7-day ET sum is unavailable (in/day, warm-season average)
const DEFAULT_DAILY_ET = 0.18;

// ── Types ─────────────────────────────────────────────────────────────────────

export type IrrigationStatus =
  | "sufficient"    // soil water well above trigger, no irrigation needed this week
  | "adequate"      // soil water OK, irrigation > 4 days away
  | "monitor"       // irrigation needed in 3–4 days
  | "irrigate_soon" // irrigation needed in 1–2 days
  | "irrigate_now"  // already below trigger
  | "flooded";      // flood-irrigated crop (rice)

export interface IrrigationDayBalance {
  date: string;
  /** Short day-of-week label */
  dayLabel: string;
  /** Net depletion that day in inches (positive = drying, negative = recharge) */
  netDepletion: number;
  /** ET demand (in) */
  et: number;
  /** Rainfall received (in) */
  rain: number;
  /** Available water remaining at end of day (in) */
  awRemaining: number;
  /** Available water as fraction of AWC (0–1) */
  awFraction: number;
}

export interface IrrigationResult {
  /** Current available water as % of total AWC (0–100) */
  currentAwPct: number;
  /** true when the soil moisture sensor provided the starting value */
  sensorBased: boolean;
  /** Total AWC for this crop's root zone (inches) */
  awcTotal: number;
  /** Available water at which irrigation is triggered (inches) */
  awTrigger: number;
  /** Calendar days until irrigation is needed; 0 = irrigate now; null = not within 7 days */
  daysUntilIrrigation: number | null;
  /** ISO date string of recommended irrigation day */
  nextIrrigationDate: string | null;
  /** Recommended application depth (inches) */
  recommendedDepthIn: number;
  status: IrrigationStatus;
  statusLabel: string;
  statusColor: string;
  /** One-sentence situation summary */
  message: string;
  /** Actionable recommendation */
  action: string;
  /** Day-by-day balance for the mini chart */
  dailyBalance: IrrigationDayBalance[];
  /** Root zone depth in inches (for display) */
  rootDepthIn: number;
  /** MAD percentage for display */
  madPct: number;
  /** Whether this is a flood-irrigated crop */
  flooded: boolean;
}

// ── Status display map ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<IrrigationStatus, string> = {
  sufficient:    "Sufficient",
  adequate:      "Adequate",
  monitor:       "Monitor",
  irrigate_soon: "Irrigate Soon",
  irrigate_now:  "Irrigate Now",
  flooded:       "Flood Irrigated",
};

const STATUS_COLORS: Record<IrrigationStatus, string> = {
  sufficient:    "#2D7A3A",
  adequate:      "#4D8A5E",
  monitor:       "#C07820",
  irrigate_soon: "#D05820",
  irrigate_now:  "#D03020",
  flooded:       "#2860A8",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(isoBase: string, n: number): string {
  const [y, m, d] = isoBase.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return SHORT_DAYS[new Date(y, m - 1, d).getDay()];
}

function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface IrrigationInput {
  soilMoisture?: number | null;
  evapotranspiration7Day?: number | null;
  precipitationDeficit?: number;
  precipitationDaily?: DailyPrecipEntry[];
  droughtRiskLevel?: string;
  cropType: string;
}

export function computeIrrigation(input: IrrigationInput): IrrigationResult {
  const {
    soilMoisture,
    evapotranspiration7Day,
    precipitationDeficit = 0,
    precipitationDaily = [],
    droughtRiskLevel = "none",
    cropType,
  } = input;

  const params = CROP_PARAMS[cropType] ?? CROP_PARAMS.other;
  const { rootDepthIn, mad } = params;
  const flooded = params.flooded ?? false;

  // ── Special case: flood-irrigated rice ────────────────────────────────────
  if (flooded) {
    return {
      currentAwPct: 100,
      sensorBased: false,
      awcTotal: AWC_PER_INCH * rootDepthIn,
      awTrigger: 0,
      daysUntilIrrigation: null,
      nextIrrigationDate: null,
      recommendedDepthIn: 0,
      status: "flooded",
      statusLabel: STATUS_LABELS.flooded,
      statusColor: STATUS_COLORS.flooded,
      message: "Rice requires continuous flooding to suppress weeds and support tiller development.",
      action: "Maintain flood depth at 3–5 inches. Drain field 5–7 days before harvest for trafficability.",
      dailyBalance: [],
      rootDepthIn,
      madPct: Math.round(mad * 100),
      flooded: true,
    };
  }

  // ── Available water capacity ──────────────────────────────────────────────
  const awcTotal = AWC_PER_INCH * rootDepthIn; // total AWC in inches
  const awTrigger = awcTotal * (1 - mad);       // irrigation trigger level

  // ── Starting soil water ───────────────────────────────────────────────────
  let awCurrent: number;
  let sensorBased: boolean;

  if (soilMoisture != null) {
    // Sensor value: clamp between wilting point and field capacity
    const smClamped = Math.max(WILTING_POINT, Math.min(FIELD_CAPACITY, soilMoisture));
    awCurrent = (smClamped - WILTING_POINT) * rootDepthIn;
    sensorBased = true;
  } else {
    // Estimate: assume moderate starting point, reduced by precipitation deficit
    // Moderate = 70% of AWC baseline, minus 80% of precip deficit
    const droughtPenalty =
      droughtRiskLevel === "critical" ? 0.25 :
      droughtRiskLevel === "high"     ? 0.15 :
      droughtRiskLevel === "moderate" ? 0.08 : 0;
    const deficitPenalty = Math.min(awcTotal * 0.5, precipitationDeficit * 0.80);
    awCurrent = Math.max(0, awcTotal * (0.70 - droughtPenalty) - deficitPenalty);
    sensorBased = false;
  }

  // ── Daily ET ─────────────────────────────────────────────────────────────
  const dailyET = evapotranspiration7Day != null && evapotranspiration7Day > 0
    ? evapotranspiration7Day / 7
    : DEFAULT_DAILY_ET;

  // ── Anchor date for labels ────────────────────────────────────────────────
  const today = new Date();
  const anchorDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // ── Day-by-day simulation ─────────────────────────────────────────────────
  const dailyBalance: IrrigationDayBalance[] = [];
  let awRunning = awCurrent;
  let daysUntilIrrigation: number | null = null;
  let awAtIrrigation = awRunning;

  // Check current state first (before day 0)
  if (awRunning <= awTrigger) {
    daysUntilIrrigation = 0;
    awAtIrrigation = awRunning;
  }

  const nDays = precipitationDaily.length > 0 ? precipitationDaily.length : 7;

  for (let i = 0; i < nDays; i++) {
    const iso = precipitationDaily[i]?.date ?? addDays(anchorDate, i);
    const rain = precipitationDaily[i]?.precipitation ?? 0;
    const et = dailyET;
    const netDepletion = Math.max(0, et - rain);

    awRunning -= netDepletion;
    // Rain surplus can recharge back to field capacity
    if (rain > et) awRunning = Math.min(awcTotal, awRunning + (rain - et));
    awRunning = Math.max(0, awRunning);

    const awFraction = awcTotal > 0 ? awRunning / awcTotal : 0;

    dailyBalance.push({
      date: iso,
      dayLabel: dayLabel(iso),
      netDepletion,
      et,
      rain,
      awRemaining: Math.round(awRunning * 100) / 100,
      awFraction: Math.round(awFraction * 100) / 100,
    });

    if (daysUntilIrrigation === null && awRunning <= awTrigger) {
      daysUntilIrrigation = i + 1; // day index + 1 (day 0 = today handled above)
      awAtIrrigation = awRunning;
    }
  }

  // ── Irrigation depth ──────────────────────────────────────────────────────
  // Fill back to field capacity; cap at 2.5" per application
  const rawDepth = Math.max(0, awcTotal - awAtIrrigation);
  const recommendedDepthIn = Math.round(Math.min(2.5, rawDepth) * 100) / 100;

  // ── Next irrigation date ──────────────────────────────────────────────────
  let nextIrrigationDate: string | null = null;
  if (daysUntilIrrigation !== null) {
    nextIrrigationDate = daysUntilIrrigation === 0
      ? anchorDate
      : addDays(anchorDate, daysUntilIrrigation);
  }

  // ── Current AW % ─────────────────────────────────────────────────────────
  const currentAwPct = awcTotal > 0
    ? Math.round(Math.min(100, Math.max(0, (awCurrent / awcTotal) * 100)))
    : 50;

  // ── Status ────────────────────────────────────────────────────────────────
  let status: IrrigationStatus;
  if (daysUntilIrrigation === 0) {
    status = "irrigate_now";
  } else if (daysUntilIrrigation !== null && daysUntilIrrigation <= 2) {
    status = "irrigate_soon";
  } else if (daysUntilIrrigation !== null && daysUntilIrrigation <= 4) {
    status = "monitor";
  } else if (currentAwPct >= 65) {
    status = "sufficient";
  } else {
    status = "adequate";
  }

  // ── Message & action ──────────────────────────────────────────────────────
  const depthStr = recommendedDepthIn > 0 ? ` Apply approximately ${recommendedDepthIn}" of water.` : "";
  const dateStr = nextIrrigationDate ? ` (${friendlyDate(nextIrrigationDate)})` : "";

  let message: string;
  let action: string;

  switch (status) {
    case "irrigate_now":
      message = `Soil water is at or below the ${Math.round(mad * 100)}% depletion trigger — irrigation is needed today.${depthStr}`;
      action = "Begin irrigation as soon as field conditions allow. Prioritise high-yield blocks first.";
      break;
    case "irrigate_soon":
      message = `Soil water will reach the trigger in ${daysUntilIrrigation} day${daysUntilIrrigation !== 1 ? "s" : ""}${dateStr}.${depthStr}`;
      action = "Schedule an irrigation set for tomorrow. Check soil at 6\" depth to confirm moisture level.";
      break;
    case "monitor":
      message = `Irrigation is estimated in ${daysUntilIrrigation} days${dateStr} based on current ET demand and forecast rain.`;
      action = "Monitor soil moisture every 1–2 days and adjust timing if rainfall underperforms the forecast.";
      break;
    case "adequate":
      message = sensorBased
        ? `Soil water is at ${currentAwPct}% of available capacity — adequate, but trending downward.`
        : `Estimated soil water is adequate. No irrigation expected in the 7-day window.`;
      action = "No immediate action needed. Continue weekly soil moisture checks.";
      break;
    case "sufficient":
    default:
      message = sensorBased
        ? `Soil water is at ${currentAwPct}% of available capacity — well above the irrigation trigger.`
        : `Precipitation balance looks favourable — no irrigation needed this week.`;
      action = "No irrigation required. Verify drainage if rainfall has been heavy.";
      break;
  }

  return {
    currentAwPct,
    sensorBased,
    awcTotal: Math.round(awcTotal * 100) / 100,
    awTrigger: Math.round(awTrigger * 100) / 100,
    daysUntilIrrigation,
    nextIrrigationDate,
    recommendedDepthIn,
    status,
    statusLabel: STATUS_LABELS[status],
    statusColor: STATUS_COLORS[status],
    message,
    action,
    dailyBalance,
    rootDepthIn,
    madPct: Math.round(mad * 100),
    flooded: false,
  };
}
