import type { FarmProfile, InputCost } from "@workspace/api-client-react";

export const BENCHMARK_DEMO_DISCLAIMER =
  "Anonymized regional benchmark sample data for demo use.";

export type SupportedBenchmarkCrop = "corn" | "soybeans";
export type BenchmarkMetricKey =
  | "seed"
  | "fertilizer"
  | "chemicals"
  | "totalInputCost"
  | "expectedYield"
  | "margin";

export type BenchmarkTone = "good" | "neutral" | "watch" | "risk" | "missing";

export interface BenchmarkRange {
  low: number;
  median: number;
  high: number;
}

export interface BenchmarkDataset {
  crop: SupportedBenchmarkCrop;
  cropLabel: string;
  regionLabel: string;
  seasonLabel: string;
  sampleLabel: string;
  yieldUnit: string;
  priceUnit: string;
  defaultCropPrice: number;
  metrics: Record<BenchmarkMetricKey, BenchmarkRange>;
}

export interface DerivedInputCostSummary {
  seed: number;
  fertilizer: number;
  chemicals: number;
  total: number;
  other: number;
  itemizedCount: number;
}

export interface BenchmarkScenarioValues {
  seed: number;
  fertilizer: number;
  chemicals: number;
  other: number;
  yieldPerAcre: number;
  cropPrice: number;
  acreage: number | null;
}

export interface BenchmarkComparison {
  label: string;
  tone: BenchmarkTone;
}

export interface BenchmarkScenarioResult {
  values: BenchmarkScenarioValues;
  revenuePerAcre: number;
  totalInputCost: number;
  marginPerAcre: number;
  totalFarmMargin: number | null;
  marginGapPerAcre: number;
  comparisons: Record<"seed" | "fertilizer" | "chemicals" | "totalInputCost" | "margin", BenchmarkComparison>;
  summary: BenchmarkComparison;
}

export const BENCHMARK_DATA: Record<SupportedBenchmarkCrop, BenchmarkDataset> = {
  corn: {
    crop: "corn",
    cropLabel: "Corn",
    regionLabel: "Iowa / Corn Belt",
    seasonLabel: "2025 planning season",
    sampleLabel: "Iowa corn operations, 500–5,000 acres (USDA ERS 2023)",
    yieldUnit: "bu/acre",
    priceUnit: "$/bu",
    defaultCropPrice: 4.45,
    metrics: {
      seed: { low: 96, median: 118, high: 145 },
      fertilizer: { low: 165, median: 205, high: 260 },
      chemicals: { low: 50, median: 72, high: 102 },
      totalInputCost: { low: 515, median: 625, high: 755 },
      expectedYield: { low: 155, median: 185, high: 215 },
      margin: { low: 70, median: 198, high: 360 },
    },
  },
  soybeans: {
    crop: "soybeans",
    cropLabel: "Soybeans",
    regionLabel: "Iowa / Corn Belt",
    seasonLabel: "2025 planning season",
    sampleLabel: "Iowa soybean operations, 500–5,000 acres (USDA ERS 2023)",
    yieldUnit: "bu/acre",
    priceUnit: "$/bu",
    defaultCropPrice: 11.65,
    metrics: {
      seed: { low: 58, median: 75, high: 96 },
      fertilizer: { low: 50, median: 76, high: 108 },
      chemicals: { low: 45, median: 64, high: 90 },
      totalInputCost: { low: 315, median: 390, high: 475 },
      expectedYield: { low: 45, median: 57, high: 68 },
      margin: { low: 130, median: 274, high: 420 },
    },
  },
};

export function normalizeBenchmarkCrop(
  cropType: string | null | undefined
): SupportedBenchmarkCrop | null {
  if (cropType === "corn" || cropType === "soybeans") return cropType;
  return null;
}

export function getBenchmarkForCrop(
  cropType: string | null | undefined
): BenchmarkDataset | null {
  const crop = normalizeBenchmarkCrop(cropType);
  return crop ? BENCHMARK_DATA[crop] : null;
}

export function effectiveCostPerAcre(
  item: InputCost,
  farmAcreage: number | null | undefined
): number | null {
  if (item.costPerAcre != null) return item.costPerAcre;
  if (item.totalCost != null) {
    const acres = item.acresApplied ?? farmAcreage;
    if (acres && acres > 0) return item.totalCost / acres;
  }
  return null;
}

export function deriveInputCostSummary(
  inputCosts: InputCost[],
  farmAcreage: number | null | undefined
): DerivedInputCostSummary {
  let seed = 0;
  let fertilizer = 0;
  let chemicals = 0;
  let total = 0;
  let itemizedCount = 0;

  for (const item of inputCosts) {
    const value = effectiveCostPerAcre(item, farmAcreage);
    if (value == null || !Number.isFinite(value)) continue;

    total += value;
    itemizedCount += 1;

    if (item.category === "seed") seed += value;
    if (item.category === "fertilizer") fertilizer += value;
    if (item.category === "herbicide" || item.category === "pesticide") {
      chemicals += value;
    }
  }

  return {
    seed,
    fertilizer,
    chemicals,
    total,
    other: Math.max(0, total - seed - fertilizer - chemicals),
    itemizedCount,
  };
}

export function getInitialBenchmarkScenario(
  profile: FarmProfile,
  inputCosts: InputCost[],
  benchmark: BenchmarkDataset
): BenchmarkScenarioValues {
  const tracked = deriveInputCostSummary(inputCosts, profile.acreage);
  const hasItemizedCosts = tracked.itemizedCount > 0;

  const seed = hasItemizedCosts && tracked.seed > 0
    ? tracked.seed
    : benchmark.metrics.seed.median;
  const fertilizer = hasItemizedCosts && tracked.fertilizer > 0
    ? tracked.fertilizer
    : benchmark.metrics.fertilizer.median;
  const chemicals = hasItemizedCosts && tracked.chemicals > 0
    ? tracked.chemicals
    : benchmark.metrics.chemicals.median;

  const coreCosts = seed + fertilizer + chemicals;
  const benchmarkOther = Math.max(
    0,
    benchmark.metrics.totalInputCost.median -
      benchmark.metrics.seed.median -
      benchmark.metrics.fertilizer.median -
      benchmark.metrics.chemicals.median
  );
  const profileOther = profile.costPerAcre != null
    ? Math.max(0, profile.costPerAcre - coreCosts)
    : null;

  return {
    seed,
    fertilizer,
    chemicals,
    other: hasItemizedCosts ? tracked.other : profileOther ?? benchmarkOther,
    yieldPerAcre:
      profile.yieldGoal != null && profile.yieldGoal > 0
        ? profile.yieldGoal
        : benchmark.metrics.expectedYield.median,
    cropPrice:
      profile.cropPrice != null && profile.cropPrice > 0
        ? profile.cropPrice
        : benchmark.defaultCropPrice,
    acreage: profile.acreage != null && profile.acreage > 0 ? profile.acreage : null,
  };
}

export function compareBenchmarkValue(
  value: number | null | undefined,
  range: BenchmarkRange,
  kind: "cost" | "margin"
): BenchmarkComparison {
  if (value == null || !Number.isFinite(value)) {
    return { label: "Needs data", tone: "missing" };
  }

  const nearMedian = Math.abs(value - range.median) / Math.max(range.median, 1) <= 0.08;

  if (kind === "cost") {
    if (value > range.high) return { label: "Above peer range", tone: "risk" };
    if (value < range.low) return { label: "Below peer range", tone: "good" };
    if (nearMedian) return { label: "Near peer median", tone: "neutral" };
    if (value > range.median) return { label: "Above peer median", tone: "watch" };
    return { label: "Below peer median", tone: "good" };
  }

  if (value < range.low) return { label: "Margin risk before signing", tone: "risk" };
  if (value > range.high) return { label: "Above peer range", tone: "good" };
  if (nearMedian) return { label: "Near peer median", tone: "neutral" };
  if (value < range.median) return { label: "Below peer median", tone: "watch" };
  return { label: "Above peer median", tone: "good" };
}

export function calculateBenchmarkScenario(
  values: BenchmarkScenarioValues,
  benchmark: BenchmarkDataset
): BenchmarkScenarioResult {
  const totalInputCost =
    values.seed + values.fertilizer + values.chemicals + values.other;
  const revenuePerAcre = values.yieldPerAcre * values.cropPrice;
  const marginPerAcre = revenuePerAcre - totalInputCost;
  const totalFarmMargin =
    values.acreage != null ? marginPerAcre * values.acreage : null;
  const marginGapPerAcre = marginPerAcre - benchmark.metrics.margin.median;

  const comparisons = {
    seed: compareBenchmarkValue(values.seed, benchmark.metrics.seed, "cost"),
    fertilizer: compareBenchmarkValue(values.fertilizer, benchmark.metrics.fertilizer, "cost"),
    chemicals: compareBenchmarkValue(values.chemicals, benchmark.metrics.chemicals, "cost"),
    totalInputCost: compareBenchmarkValue(
      totalInputCost,
      benchmark.metrics.totalInputCost,
      "cost"
    ),
    margin: compareBenchmarkValue(marginPerAcre, benchmark.metrics.margin, "margin"),
  };

  const summary =
    comparisons.margin.tone === "risk"
      ? comparisons.margin
      : comparisons.totalInputCost.tone === "risk"
        ? { label: "Input quote is above peer range", tone: "risk" as const }
        : comparisons.margin;

  return {
    values,
    revenuePerAcre,
    totalInputCost,
    marginPerAcre,
    totalFarmMargin,
    marginGapPerAcre,
    comparisons,
    summary,
  };
}

export function formatMoney(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
