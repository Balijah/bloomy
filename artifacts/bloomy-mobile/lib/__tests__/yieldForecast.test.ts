import { describe, it, expect } from "vitest";
import { computeYieldForecast, YIELD_PROFILES_PUBLIC, type YieldForecastInput } from "../yieldForecast";

// ── Fixture ───────────────────────────────────────────────────────────────────

const noStress: YieldForecastInput = {
  cropType: "corn",
  currentStageIndex: 0,
  totalStages: 5,
  frostRiskLevel: "none",
  heatStressRiskLevel: "none",
  droughtRiskLevel: "none",
  harvestDisruptionRiskLevel: "none",
  precipitationDeficit: 0,
  criticalEventCount: 0,
};

// ── Basic invariants ──────────────────────────────────────────────────────────

describe("computeYieldForecast — basic invariants", () => {
  it("estimatedLow is always <= estimatedHigh", () => {
    const result = computeYieldForecast(noStress);
    expect(result.estimatedLow).toBeLessThanOrEqual(result.estimatedHigh);
  });

  it("estimatedLow and estimatedHigh are finite positive integers", () => {
    const result = computeYieldForecast(noStress);
    expect(Number.isFinite(result.estimatedLow)).toBe(true);
    expect(Number.isFinite(result.estimatedHigh)).toBe(true);
    expect(result.estimatedLow).toBeGreaterThan(0);
  });

  it("no-stress forecast has zero totalStressPenalty and empty stressItems", () => {
    const result = computeYieldForecast(noStress);
    expect(result.totalStressPenalty).toBe(0);
    expect(result.stressItems).toHaveLength(0);
  });

  it("no-stress baseline equals the crop average yield", () => {
    const result = computeYieldForecast(noStress);
    expect(result.baseline).toBe(YIELD_PROFILES_PUBLIC.corn.avg);
  });
});

// ── Stress penalties ──────────────────────────────────────────────────────────

describe("computeYieldForecast — stress penalties", () => {
  it("critical frost applies an 18% penalty", () => {
    const result = computeYieldForecast({ ...noStress, frostRiskLevel: "critical" });
    expect(result.totalStressPenalty).toBe(0.18);
    expect(result.stressItems).toHaveLength(1);
    expect(result.stressItems[0].penalty).toBe(0.18);
    expect(result.stressItems[0].level).toBe("critical");
  });

  it("high heat stress applies a 12% penalty", () => {
    const result = computeYieldForecast({ ...noStress, heatStressRiskLevel: "high" });
    expect(result.totalStressPenalty).toBe(0.12);
  });

  it("moderate drought applies a 6% penalty", () => {
    const result = computeYieldForecast({ ...noStress, droughtRiskLevel: "moderate" });
    expect(result.totalStressPenalty).toBe(0.06);
  });

  it("low risk applies a 2% penalty", () => {
    const result = computeYieldForecast({ ...noStress, frostRiskLevel: "low" });
    expect(result.totalStressPenalty).toBe(0.02);
  });

  it("total stress penalty is capped at 40%", () => {
    const result = computeYieldForecast({
      ...noStress,
      frostRiskLevel: "critical",            // 0.18
      heatStressRiskLevel: "critical",        // 0.18
      droughtRiskLevel: "critical",           // 0.18
      harvestDisruptionRiskLevel: "critical", // 0.18 → raw sum = 0.72
    });
    expect(result.totalStressPenalty).toBe(0.40);
  });

  it("multiple critical events beyond 1 add a surcharge penalty", () => {
    const baseline = computeYieldForecast(noStress);
    const withExtra = computeYieldForecast({ ...noStress, criticalEventCount: 3 });
    // criticalEventCount = 3 → (3-1) * 0.03 = 0.06 surcharge
    expect(withExtra.totalStressPenalty).toBeGreaterThan(baseline.totalStressPenalty);
    const extraItem = withExtra.stressItems.find((s) => s.label === "Multiple Extreme Events");
    expect(extraItem).toBeDefined();
    expect(extraItem?.penalty).toBeCloseTo(0.06);
  });

  it("extra critical event surcharge is capped at 12%", () => {
    const result = computeYieldForecast({ ...noStress, criticalEventCount: 100 });
    const extraItem = result.stressItems.find((s) => s.label === "Multiple Extreme Events");
    expect(extraItem?.penalty).toBe(0.12);
  });

  it("stress reduces estimatedHigh relative to no-stress forecast", () => {
    const clean = computeYieldForecast(noStress);
    const stressed = computeYieldForecast({ ...noStress, droughtRiskLevel: "critical" });
    expect(stressed.estimatedHigh).toBeLessThan(clean.estimatedHigh);
  });
});

// ── Stage confidence ──────────────────────────────────────────────────────────

describe("computeYieldForecast — stage confidence", () => {
  it("stage 0 sets earlyEstimate to true", () => {
    const result = computeYieldForecast({ ...noStress, currentStageIndex: 0, totalStages: 5 });
    expect(result.earlyEstimate).toBe(true);
  });

  it("later stages set earlyEstimate to false", () => {
    const result = computeYieldForecast({ ...noStress, currentStageIndex: 3, totalStages: 5 });
    expect(result.earlyEstimate).toBe(false);
  });

  it("late-season estimate has a tighter range than early-season", () => {
    const early = computeYieldForecast({ ...noStress, currentStageIndex: 0, totalStages: 5 });
    const late = computeYieldForecast({ ...noStress, currentStageIndex: 4, totalStages: 5 });
    const earlyRange = early.estimatedHigh - early.estimatedLow;
    const lateRange = late.estimatedHigh - late.estimatedLow;
    expect(lateRange).toBeLessThan(earlyRange);
  });

  it("early-season confidence label is 'low'", () => {
    const result = computeYieldForecast({ ...noStress, currentStageIndex: 0, totalStages: 5 });
    expect(result.confidence).toBe("low");
  });

  it("late-season confidence label is 'high'", () => {
    const result = computeYieldForecast({ ...noStress, currentStageIndex: 4, totalStages: 5 });
    expect(result.confidence).toBe("high");
  });
});

// ── Crop profiles ─────────────────────────────────────────────────────────────

describe("computeYieldForecast — crop profiles", () => {
  it("known crop sets isGeneric to false", () => {
    const result = computeYieldForecast(noStress);
    expect(result.isGeneric).toBe(false);
    expect(result.profile).toEqual(YIELD_PROFILES_PUBLIC.corn);
  });

  it("unknown crop falls back to the generic profile and sets isGeneric to true", () => {
    const result = computeYieldForecast({ ...noStress, cropType: "quinoa" });
    expect(result.isGeneric).toBe(true);
    expect(result.profile).toEqual(YIELD_PROFILES_PUBLIC.other);
  });

  it("'other' crop type uses the generic profile", () => {
    const result = computeYieldForecast({ ...noStress, cropType: "other" });
    expect(result.isGeneric).toBe(true);
  });

  it("soybeans uses the correct baseline", () => {
    const result = computeYieldForecast({ ...noStress, cropType: "soybeans" });
    expect(result.baseline).toBe(YIELD_PROFILES_PUBLIC.soybeans.avg);
  });

  it("all named crop types return positive estimates", () => {
    const crops = ["corn", "soybeans", "winter_wheat", "cotton", "potatoes", "grapes", "almonds", "apples", "rice"];
    for (const cropType of crops) {
      const result = computeYieldForecast({ ...noStress, cropType });
      expect(result.estimatedLow).toBeGreaterThan(0);
      expect(result.estimatedHigh).toBeGreaterThanOrEqual(result.estimatedLow);
    }
  });
});
