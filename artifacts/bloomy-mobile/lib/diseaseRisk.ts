/**
 * diseaseRisk.ts
 *
 * Computes a crop disease pressure score from already-loaded AgricultureInsights
 * data.  No additional API calls required.
 *
 * Algorithm:
 *   Score = soilFactor(0-3) + precipFactor(0-3) + tempFactor(0-2) + droughtAdj(-1/0)
 *   Clamped to [0, 8].
 *
 * Levels:
 *   0-2  → low      (#2D9B5A green)
 *   3-4  → moderate (#E8A020 amber)
 *   5-6  → high     (#E05820 orange)
 *   7-8  → severe   (#D02020 red)
 */

import type { AgricultureInsights } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiseaseRiskFactor {
  name: string;
  icon: string;
  value: string;
  detail: string;
  score: number;
  max: number;
}

export interface DiseaseRiskResult {
  level: "low" | "moderate" | "high" | "severe";
  score: number;
  color: string;
  label: string;
  summary: string;
  advice: string[];
  factors: DiseaseRiskFactor[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  low: "#2D9B5A",
  moderate: "#E8A020",
  high: "#E05820",
  severe: "#D02020",
};

const LEVEL_LABEL: Record<string, string> = {
  low: "Low Disease Pressure",
  moderate: "Moderate Disease Pressure",
  high: "High Disease Pressure",
  severe: "Severe Disease Pressure",
};

const LEVEL_SUMMARY: Record<string, string> = {
  low: "Current conditions are not favorable for significant disease development.",
  moderate:
    "Conditions are somewhat favorable for disease. Monitor fields closely over the next few days.",
  high:
    "Conditions are highly favorable for fungal and bacterial disease spread. Scout fields now.",
  severe:
    "Critical disease conditions. Immediate scouting and treatment action is strongly recommended.",
};

// Crop-specific advice per risk level.
// Falls back to "other" when cropType is not found.
type CropAdvice = Record<string, string[]>;
const CROP_ADVICE: Record<string, CropAdvice> = {
  corn: {
    low: [
      "Continue routine scouting for gray leaf spot and northern corn leaf blight.",
      "Maintain adequate crop spacing for airflow.",
    ],
    moderate: [
      "Scout weekly for gray leaf spot — focus on lower canopy leaves first.",
      "Avoid overhead irrigation during humid evenings.",
      "Ensure fungicide program aligns with tassel / VT timing.",
    ],
    high: [
      "Apply a protective fungicide before tassel if not already applied.",
      "Scout every 3-4 days for common rust and tar spot symptoms.",
      "Remove infected tissue where practical to limit spore load.",
    ],
    severe: [
      "Apply curative/protectant fungicide immediately if weather window allows.",
      "Contact your agronomist — tar spot or gray leaf spot epidemics move fast.",
      "Document lesion spread across field zones for insurance records.",
    ],
  },
  soybeans: {
    low: [
      "Routine scouting for frogeye leaf spot and sudden death syndrome.",
      "Check seed treatments are performing as expected at this growth stage.",
    ],
    moderate: [
      "Scout for white mold and frogeye leaf spot starting at R1 (first flower).",
      "Evaluate canopy closure — dense canopies trap humidity.",
    ],
    high: [
      "Apply registered fungicide at R1-R3 if disease pressure confirmed.",
      "White mold spores are active — consider biocontrols if economically viable.",
      "Rotate to non-host crops in heavily infected fields next season.",
    ],
    severe: [
      "White mold or downy mildew epidemic conditions — apply fungicide within 48 hours.",
      "Harvest affected fields first to prevent spread.",
      "Document infection levels by field for crop insurance claims.",
    ],
  },
  winter_wheat: {
    low: [
      "Routine scouting for septoria and powdery mildew.",
      "Monitor aphid populations which can vector viral disease.",
    ],
    moderate: [
      "Scout flag leaf for septoria leaf blotch and stripe rust.",
      "Fungicide at flag-leaf (GS37) is cost-effective at this pressure level.",
    ],
    high: [
      "Apply a strobilurin-triazole mix at GS37-GS59 to protect yield.",
      "Stripe rust can progress from trace to 100% in 10-14 days — act now.",
      "Check varieties for known susceptibility ratings.",
    ],
    severe: [
      "Fusarium head blight (scab) risk is elevated — apply tebuconazole at early anthesis.",
      "Scab toxin (DON) contamination can render grain unmarketable — document and test.",
      "Contact your agronomist immediately for emergency spray scheduling.",
    ],
  },
  cotton: {
    low: [
      "Routine scouting for bacterial blight and target spot.",
      "Monitor for boll weevil which can create entry points for disease.",
    ],
    moderate: [
      "Scout for target spot and areolate mildew in dense canopies.",
      "Reduce canopy humidity with balanced fertiliser — avoid excess nitrogen.",
    ],
    high: [
      "Apply a registered fungicide at first sign of target spot lesions.",
      "Consider growth regulator to reduce rank growth and improve airflow.",
    ],
    severe: [
      "Apply fungicide immediately and reassess canopy management.",
      "Severe bacterial blight is weather-driven — avoid tissue injury during storms.",
    ],
  },
  almonds: {
    low: [
      "Routine monitoring for hull rot and shot hole fungus.",
      "Good sanitation around base of trees reduces overwintering inoculum.",
    ],
    moderate: [
      "Scout for hull rot during hull split — wet conditions accelerate Monilinia.",
      "Consider copper spray program if brown rot was a problem last season.",
    ],
    high: [
      "Apply a hull rot fungicide at 10-15% hull split.",
      "Remove mummified nuts from trees and ground to reduce spore load.",
    ],
    severe: [
      "Immediate fungicide application at hull split — brown rot moves very fast.",
      "Post-harvest sanitation is critical to break the disease cycle.",
    ],
  },
  grapes: {
    low: [
      "Routine scouting for powdery mildew and botrytis.",
      "Maintain open canopy with shoot positioning and leaf removal.",
    ],
    moderate: [
      "Begin powdery mildew spray program — target 7-10 day intervals.",
      "Focus on shoot bases and clusters which are most susceptible.",
    ],
    high: [
      "Apply sulfur or bicarbonate fungicide immediately; rotate modes of action.",
      "Increase spray frequency to 7 days maximum.",
      "Downy mildew risk is high — inspect undersides of leaves for sporulation.",
    ],
    severe: [
      "Botrytis and downy mildew epidemic risk — protect clusters now.",
      "Harvest early if canopy is fully infected and fruit is near maturity.",
      "Contact your viticulture advisor — resistant varieties may be needed long-term.",
    ],
  },
  apples: {
    low: [
      "Routine scouting for scab and fire blight.",
      "Ensure copper program covers early pink and petal fall stages.",
    ],
    moderate: [
      "Apple scab infection periods are likely — apply protectant fungicide.",
      "Mancozeb or captan at petal fall through first cover sprays.",
    ],
    high: [
      "Apply a post-infection (kickback) fungicide within 72 hours of infection period.",
      "Fire blight risk is elevated — avoid wound-causing operations during bloom.",
    ],
    severe: [
      "Scab or fire blight epidemic underway — apply strobilurin/SDHI at tightest interval.",
      "Prune out fire blight strikes immediately, cutting 12 inches below visible symptoms.",
      "Document damage area by block for insurance and replanting decisions.",
    ],
  },
  potatoes: {
    low: [
      "Routine scouting for early blight and black leg.",
      "Maintain plant hilling to prevent tuber exposure.",
    ],
    moderate: [
      "Scout weekly for early and late blight lesions — start at canopy edges.",
      "Begin preventive fungicide program if forecasted wet weather continues.",
    ],
    high: [
      "Apply a registered late blight fungicide (mancozeb, chlorothalonil) within 48 hours.",
      "Late blight can destroy a field in 7-10 days under these conditions.",
    ],
    severe: [
      "Emergency late blight response needed — apply immediately.",
      "Consider vine desiccation of heavily infected fields to protect tubers.",
      "Document and report late blight to your local extension service.",
    ],
  },
  rice: {
    low: [
      "Routine scouting for rice blast and sheath blight.",
      "Maintain consistent flood depth — shallow water increases blast risk.",
    ],
    moderate: [
      "Scout leaf blast symptoms — especially in blast-susceptible varieties.",
      "Consider propiconazole application if blast lesions are detected.",
    ],
    high: [
      "Apply a blast fungicide (azoxystrobin, tricyclazole) at heading.",
      "Sheath blight spreads rapidly at this humidity — scout every 3-4 days.",
    ],
    severe: [
      "Neck blast epidemic risk at heading — apply fungicide immediately.",
      "Neck blast can destroy entire panicles; do not delay treatment.",
    ],
  },
  other: {
    low: [
      "Continue routine scouting appropriate for your crop.",
      "Disease pressure is currently low — maintain good agronomic hygiene.",
    ],
    moderate: [
      "Begin more frequent scouting — humid conditions are building.",
      "Review your registered fungicide options and check stock levels.",
    ],
    high: [
      "Consult your agronomist for a crop-specific fungicide recommendation.",
      "Scout twice weekly and document any new symptoms with photos.",
    ],
    severe: [
      "Act now — conditions are at peak disease risk.",
      "Contact your agronomist or extension service for emergency guidance.",
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function soilFactor(
  soilMoisture: number | null | undefined
): { score: number; value: string; detail: string } {
  const pct = soilMoisture ?? 50;
  if (pct >= 75)
    return {
      score: 3,
      value: `${Math.round(pct)}%`,
      detail: "Very moist — prolonged leaf wetness likely",
    };
  if (pct >= 55)
    return {
      score: 2,
      value: `${Math.round(pct)}%`,
      detail: "Adequate moisture — conditions support pathogen activity",
    };
  if (pct >= 35)
    return {
      score: 1,
      value: `${Math.round(pct)}%`,
      detail: "Moderate moisture — limited disease pressure from soil",
    };
  return {
    score: 0,
    value: `${Math.round(pct)}%`,
    detail: "Dry soil — low leaf-wetness disease risk",
  };
}

function precipFactor(
  deficit: number,
  forecast: number
): { score: number; value: string; detail: string } {
  // deficit: 14-day inches below average (0 = at/above average, i.e. wet)
  // forecast: next-7-day total inches
  if (deficit <= 0.3 && forecast >= 1.0)
    return {
      score: 3,
      value: `+${forecast.toFixed(1)}" expected`,
      detail: "Wet conditions now and more rain forecast",
    };
  if (deficit <= 0.5)
    return {
      score: 2,
      value: `${deficit.toFixed(1)}" deficit`,
      detail: "Near-average rainfall — soil stays moist",
    };
  if (deficit <= 1.5)
    return {
      score: 1,
      value: `${deficit.toFixed(1)}" deficit`,
      detail: "Slightly below-average precipitation",
    };
  return {
    score: 0,
    value: `${deficit.toFixed(1)}" deficit`,
    detail: "Significant rainfall deficit — dry conditions limit disease",
  };
}

function tempFactor(temperatureDaily: { tempMax: number; tempMin: number }[]): {
  score: number;
  value: string;
  detail: string;
} {
  if (temperatureDaily.length === 0)
    return { score: 1, value: "—", detail: "Temperature data unavailable" };

  const avgMean =
    temperatureDaily.reduce((s, d) => s + (d.tempMax + d.tempMin) / 2, 0) /
    temperatureDaily.length;

  if (avgMean >= 60 && avgMean <= 80)
    return {
      score: 2,
      value: `${Math.round(avgMean)}°F avg`,
      detail: "Ideal range for fungal and bacterial pathogens (60-80°F)",
    };
  if (avgMean >= 50 && avgMean <= 90)
    return {
      score: 1,
      value: `${Math.round(avgMean)}°F avg`,
      detail: "Marginal temperature range — some pathogen activity possible",
    };
  return {
    score: 0,
    value: `${Math.round(avgMean)}°F avg`,
    detail:
      avgMean < 50
        ? "Too cold for most fungal pathogens"
        : "Too hot — heat suppresses many foliar pathogens",
  };
}

function droughtFactor(droughtLevel: string): {
  adj: number;
  value: string;
  detail: string;
} {
  if (droughtLevel === "high" || droughtLevel === "critical")
    return {
      adj: -1,
      value: "High drought",
      detail: "Drought stress suppresses many foliar and soil-borne diseases",
    };
  if (droughtLevel === "moderate")
    return {
      adj: 0,
      value: "Moderate drought",
      detail: "Some dryness — root diseases can still be active",
    };
  return {
    adj: 0,
    value: "Low drought stress",
    detail: "Adequate water availability supports pathogen activity",
  };
}

function scoreToLevel(score: number): "low" | "moderate" | "high" | "severe" {
  if (score >= 7) return "severe";
  if (score >= 5) return "high";
  if (score >= 3) return "moderate";
  return "low";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeDiseaseRisk(
  insights: AgricultureInsights
): DiseaseRiskResult {
  const soil = soilFactor(insights.soilMoisture);
  const precip = precipFactor(
    insights.precipitationDeficit,
    insights.precipitationForecast
  );
  const temp = tempFactor(insights.temperatureDaily ?? []);
  const drought = droughtFactor(insights.droughtRisk.level);

  const rawScore = soil.score + precip.score + temp.score + drought.adj;
  const score = Math.min(8, Math.max(0, rawScore));
  const level = scoreToLevel(score);

  const cropKey = (insights.cropType ?? "other").toLowerCase().replace(/-/g, "_");
  const adviceMap = CROP_ADVICE[cropKey] ?? CROP_ADVICE["other"];
  const advice = adviceMap[level] ?? adviceMap["low"];

  const factors: DiseaseRiskFactor[] = [
    {
      name: "Soil Moisture",
      icon: "water-outline",
      value: soil.value,
      detail: soil.detail,
      score: soil.score,
      max: 3,
    },
    {
      name: "Rainfall",
      icon: "rainy-outline",
      value: precip.value,
      detail: precip.detail,
      score: precip.score,
      max: 3,
    },
    {
      name: "Temperature",
      icon: "thermometer-outline",
      value: temp.value,
      detail: temp.detail,
      score: temp.score,
      max: 2,
    },
    {
      name: "Drought Index",
      icon: "sunny-outline",
      value: drought.value,
      detail: drought.detail,
      score: Math.max(0, drought.adj + 1), // normalise: 0 adj → 1 (neutral), -1 → 0 (suppressing)
      max: 1,
    },
  ];

  return {
    level,
    score,
    color: LEVEL_COLOR[level],
    label: LEVEL_LABEL[level],
    summary: LEVEL_SUMMARY[level],
    advice,
    factors,
  };
}
