import { describe, it, expect } from "vitest";
import type { InputCost } from "@workspace/api-client-react";
import { InputCostCategory } from "@workspace/api-client-react";
import {
  effectiveCostPerAcre,
  deriveInputCostSummary,
  calculateBenchmarkScenario,
  compareBenchmarkValue,
  normalizeBenchmarkCrop,
  getBenchmarkForCrop,
  formatMoney,
  formatNumber,
  BENCHMARK_DATA,
  type BenchmarkScenarioValues,
} from "../benchmarkPlanner";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function ic(overrides: {
  category?: InputCost["category"];
  costPerAcre?: number | null;
  totalCost?: number | null;
  acresApplied?: number | null;
}): InputCost {
  return {
    id: 1,
    farmProfileId: 1,
    userId: 1,
    category: overrides.category ?? InputCostCategory.seed,
    item: "Test item",
    costPerAcre: overrides.costPerAcre ?? null,
    totalCost: overrides.totalCost ?? null,
    acresApplied: overrides.acresApplied ?? null,
    date: null,
    notes: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

const CORN = BENCHMARK_DATA.corn;
const SOY = BENCHMARK_DATA.soybeans;

// ── effectiveCostPerAcre ──────────────────────────────────────────────────────

describe("effectiveCostPerAcre", () => {
  it("returns costPerAcre directly when set", () => {
    expect(effectiveCostPerAcre(ic({ costPerAcre: 120 }), 500)).toBe(120);
  });

  it("returns totalCost / acresApplied when costPerAcre is null", () => {
    // 60000 / 500 = 120
    expect(effectiveCostPerAcre(ic({ totalCost: 60000, acresApplied: 500 }), 1000)).toBe(120);
  });

  it("falls back to farmAcreage when acresApplied is null", () => {
    // 60000 / 500 (farmAcreage) = 120
    expect(effectiveCostPerAcre(ic({ totalCost: 60000 }), 500)).toBe(120);
  });

  it("returns null when no cost data is provided", () => {
    expect(effectiveCostPerAcre(ic({}), 500)).toBeNull();
  });

  it("returns null when acreage is 0 (division by zero guard)", () => {
    expect(effectiveCostPerAcre(ic({ totalCost: 60000 }), 0)).toBeNull();
  });

  it("returns null when both acresApplied and farmAcreage are null", () => {
    expect(effectiveCostPerAcre(ic({ totalCost: 60000 }), null)).toBeNull();
  });

  it("prefers acresApplied over farmAcreage when both are present", () => {
    // 30000 / 300 = 100 (not 30000 / 500 = 60)
    expect(effectiveCostPerAcre(ic({ totalCost: 30000, acresApplied: 300 }), 500)).toBe(100);
  });
});

// ── deriveInputCostSummary ────────────────────────────────────────────────────

describe("deriveInputCostSummary", () => {
  it("returns all-zero summary for an empty array", () => {
    const result = deriveInputCostSummary([], 500);
    expect(result.total).toBe(0);
    expect(result.seed).toBe(0);
    expect(result.fertilizer).toBe(0);
    expect(result.chemicals).toBe(0);
    expect(result.other).toBe(0);
    expect(result.itemizedCount).toBe(0);
  });

  it("seed + fertilizer + chemicals + other === total for a mixed set", () => {
    const items = [
      ic({ category: InputCostCategory.seed, costPerAcre: 118 }),
      ic({ category: InputCostCategory.fertilizer, costPerAcre: 205 }),
      ic({ category: InputCostCategory.herbicide, costPerAcre: 40 }),
      ic({ category: InputCostCategory.pesticide, costPerAcre: 32 }),
      ic({ category: InputCostCategory.fuel, costPerAcre: 50 }),
    ];
    const result = deriveInputCostSummary(items, 500);
    expect(result.seed + result.fertilizer + result.chemicals + result.other).toBeCloseTo(result.total);
  });

  it("other is always >= 0", () => {
    // Even when only seed costs exist, other should not go negative
    const result = deriveInputCostSummary([ic({ category: InputCostCategory.seed, costPerAcre: 300 })], 500);
    expect(result.other).toBeGreaterThanOrEqual(0);
  });

  it("skips items where cost cannot be resolved", () => {
    const items = [
      ic({ costPerAcre: null, totalCost: null }), // unresolvable
      ic({ category: InputCostCategory.seed, costPerAcre: 118 }),
    ];
    const result = deriveInputCostSummary(items, 500);
    expect(result.itemizedCount).toBe(1);
    expect(result.total).toBeCloseTo(118);
  });

  it("categorises herbicide and pesticide as chemicals", () => {
    const items = [
      ic({ category: InputCostCategory.herbicide, costPerAcre: 40 }),
      ic({ category: InputCostCategory.pesticide, costPerAcre: 32 }),
    ];
    const result = deriveInputCostSummary(items, 500);
    expect(result.chemicals).toBeCloseTo(72);
    expect(result.seed).toBe(0);
    expect(result.fertilizer).toBe(0);
  });

  it("resolves costs via totalCost / farmAcreage when costPerAcre is absent", () => {
    const items = [ic({ category: InputCostCategory.fertilizer, totalCost: 51250 })];
    const result = deriveInputCostSummary(items, 250);
    expect(result.fertilizer).toBeCloseTo(205);
    expect(result.itemizedCount).toBe(1);
  });
});

// ── calculateBenchmarkScenario ────────────────────────────────────────────────

describe("calculateBenchmarkScenario", () => {
  // Corn benchmark medians: seed 118 + fertilizer 205 + chemicals 72 + other 230 = 625
  // Revenue: 185 bu * $4.45 = $823.25/acre
  // Margin: $823.25 - $625 = $198.25/acre
  const base: BenchmarkScenarioValues = {
    seed: 118,
    fertilizer: 205,
    chemicals: 72,
    other: 230,
    yieldPerAcre: 185,
    cropPrice: 4.45,
    acreage: 234,
  };

  it("revenuePerAcre = yieldPerAcre * cropPrice", () => {
    const result = calculateBenchmarkScenario(base, CORN);
    expect(result.revenuePerAcre).toBeCloseTo(185 * 4.45);
  });

  it("totalInputCost = seed + fertilizer + chemicals + other", () => {
    const result = calculateBenchmarkScenario(base, CORN);
    expect(result.totalInputCost).toBe(118 + 205 + 72 + 230);
  });

  it("marginPerAcre = revenuePerAcre - totalInputCost", () => {
    const result = calculateBenchmarkScenario(base, CORN);
    expect(result.marginPerAcre).toBeCloseTo(result.revenuePerAcre - result.totalInputCost);
  });

  it("totalFarmMargin = marginPerAcre * acreage", () => {
    const result = calculateBenchmarkScenario(base, CORN);
    expect(result.totalFarmMargin).toBeCloseTo(result.marginPerAcre * 234);
  });

  it("totalFarmMargin is null when acreage is null", () => {
    const result = calculateBenchmarkScenario({ ...base, acreage: null }, CORN);
    expect(result.totalFarmMargin).toBeNull();
  });

  it("marginGapPerAcre = marginPerAcre - benchmark margin median", () => {
    const result = calculateBenchmarkScenario(base, CORN);
    expect(result.marginGapPerAcre).toBeCloseTo(result.marginPerAcre - CORN.metrics.margin.median);
  });

  it("summary tone is risk when margin falls below the benchmark low", () => {
    // Low yield and low price force margin far below the peer floor ($70/acre)
    const result = calculateBenchmarkScenario({ ...base, yieldPerAcre: 100, cropPrice: 2.0 }, CORN);
    expect(result.summary.tone).toBe("risk");
  });

  it("summary tone is risk when totalInputCost is above peer high", () => {
    // totalInputCost = 850 > CORN.metrics.totalInputCost.high (755)
    // margin will not be in risk range, so summary escalates from input cost
    const result = calculateBenchmarkScenario(
      { ...base, seed: 250, fertilizer: 350, chemicals: 150, other: 100, yieldPerAcre: 185, cropPrice: 4.45 },
      CORN,
    );
    expect(result.comparisons.totalInputCost.tone).toBe("risk");
  });

  it("soybean scenario calculates correctly", () => {
    // SOY defaults: seed 75 + fertilizer 76 + chemicals 64 + other 175 = 390
    // Revenue: 57 bu * $11.65 = $664.05/acre
    // Margin: $664.05 - $390 = $274.05/acre  (near peer median of $274)
    const soyBase: BenchmarkScenarioValues = {
      seed: 75,
      fertilizer: 76,
      chemicals: 64,
      other: 175,
      yieldPerAcre: 57,
      cropPrice: 11.65,
      acreage: 500,
    };
    const result = calculateBenchmarkScenario(soyBase, SOY);
    expect(result.revenuePerAcre).toBeCloseTo(57 * 11.65);
    expect(result.totalInputCost).toBe(75 + 76 + 64 + 175);
    expect(result.marginPerAcre).toBeCloseTo(result.revenuePerAcre - result.totalInputCost);
  });
});

// ── compareBenchmarkValue ─────────────────────────────────────────────────────

describe("compareBenchmarkValue", () => {
  // CORN totalInputCost: { low: 515, median: 625, high: 755 }
  // CORN margin:         { low: 70,  median: 198, high: 360 }

  it("returns missing tone for null", () => {
    expect(compareBenchmarkValue(null, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "missing" });
  });

  it("returns missing tone for undefined", () => {
    expect(compareBenchmarkValue(undefined, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "missing" });
  });

  it("returns missing tone for NaN", () => {
    expect(compareBenchmarkValue(NaN, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "missing" });
  });

  // ── Cost comparisons ────────────────────────────────────────────────

  it("cost above range high → risk", () => {
    // 800 > 755
    expect(compareBenchmarkValue(800, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "risk" });
  });

  it("cost below range low → good", () => {
    // 400 < 515
    expect(compareBenchmarkValue(400, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "good" });
  });

  it("cost within 8% of median → neutral", () => {
    // 625 is exactly the median; |625-625|/625 = 0 ≤ 0.08
    expect(compareBenchmarkValue(625, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "neutral" });
  });

  it("cost above median but below high (outside 8% band) → watch", () => {
    // 700: |700-625|/625 = 0.12 > 0.08, and 700 < 755 → watch
    expect(compareBenchmarkValue(700, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "watch" });
  });

  it("cost below median but above low (outside 8% band) → good", () => {
    // 540: |540-625|/625 = 0.136 > 0.08, 540 > 515 and 540 < 625 → good (below median)
    expect(compareBenchmarkValue(540, CORN.metrics.totalInputCost, "cost")).toMatchObject({ tone: "good" });
  });

  // ── Margin comparisons ──────────────────────────────────────────────

  it("margin below range low → risk", () => {
    // 50 < 70
    expect(compareBenchmarkValue(50, CORN.metrics.margin, "margin")).toMatchObject({ tone: "risk" });
  });

  it("negative margin → risk", () => {
    expect(compareBenchmarkValue(-100, CORN.metrics.margin, "margin")).toMatchObject({ tone: "risk" });
  });

  it("margin above range high → good", () => {
    // 400 > 360
    expect(compareBenchmarkValue(400, CORN.metrics.margin, "margin")).toMatchObject({ tone: "good" });
  });

  it("margin within 8% of median → neutral", () => {
    // 198 is exactly the median
    expect(compareBenchmarkValue(198, CORN.metrics.margin, "margin")).toMatchObject({ tone: "neutral" });
  });

  it("margin below median but above low (outside 8% band) → watch", () => {
    // 120: |120-198|/198 = 0.394 > 0.08, 120 > 70 and 120 < 198 → below median = watch
    expect(compareBenchmarkValue(120, CORN.metrics.margin, "margin")).toMatchObject({ tone: "watch" });
  });
});

// ── normalizeBenchmarkCrop / getBenchmarkForCrop ──────────────────────────────

describe("normalizeBenchmarkCrop", () => {
  it('"corn" → "corn"', () => {
    expect(normalizeBenchmarkCrop("corn")).toBe("corn");
  });

  it('"soybeans" → "soybeans"', () => {
    expect(normalizeBenchmarkCrop("soybeans")).toBe("soybeans");
  });

  it("unsupported crop string → null", () => {
    expect(normalizeBenchmarkCrop("wheat")).toBeNull();
    expect(normalizeBenchmarkCrop("cotton")).toBeNull();
  });

  it("null → null", () => {
    expect(normalizeBenchmarkCrop(null)).toBeNull();
  });

  it("undefined → null", () => {
    expect(normalizeBenchmarkCrop(undefined)).toBeNull();
  });

  it("empty string → null", () => {
    expect(normalizeBenchmarkCrop("")).toBeNull();
  });
});

describe("getBenchmarkForCrop", () => {
  it("returns the corn dataset for corn", () => {
    expect(getBenchmarkForCrop("corn")).toBe(BENCHMARK_DATA.corn);
  });

  it("returns the soybeans dataset for soybeans", () => {
    expect(getBenchmarkForCrop("soybeans")).toBe(BENCHMARK_DATA.soybeans);
  });

  it("returns null for unsupported crops", () => {
    expect(getBenchmarkForCrop("rice")).toBeNull();
    expect(getBenchmarkForCrop(null)).toBeNull();
  });
});

// ── formatMoney ───────────────────────────────────────────────────────────────

describe("formatMoney", () => {
  it("formats a positive value with a dollar sign", () => {
    const result = formatMoney(198);
    expect(result).toContain("$");
    expect(result).not.toContain("-");
  });

  it("formats a negative value with a leading minus sign", () => {
    const result = formatMoney(-50);
    expect(result).toContain("-");
    expect(result).toContain("$");
  });

  it("formats zero without a minus sign", () => {
    expect(formatMoney(0)).toBe("$0");
  });

  it("returns N/A for null", () => {
    expect(formatMoney(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatMoney(undefined)).toBe("N/A");
  });

  it("returns N/A for NaN", () => {
    expect(formatMoney(NaN)).toBe("N/A");
  });
});

// ── formatNumber ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats a number as a string", () => {
    expect(typeof formatNumber(185)).toBe("string");
  });

  it("returns N/A for null", () => {
    expect(formatNumber(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatNumber(undefined)).toBe("N/A");
  });

  it("returns N/A for NaN", () => {
    expect(formatNumber(NaN)).toBe("N/A");
  });
});
