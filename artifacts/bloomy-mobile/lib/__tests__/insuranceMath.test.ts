import { describe, it, expect } from "vitest";
import { computeInsurance } from "../insuranceMath";

// ── Base fixture (RP plan, corn, 75% coverage) ────────────────────────────────
// APH: 185 bu/acre
// Coverage: 75%  →  yield guarantee = 138.75 bu/acre
// Projected price: $4.70/bu  →  revenue guarantee/acre = 185 * 0.75 * 4.70 = $651.375
// Acreage: 234
// Forecast: low 140, mid 175, high 210

const base = {
  planType: "RP" as const,
  aphYield: 185,
  coverageLevel: 0.75,
  projectedPrice: 4.70,
  priceElection: 1.00,
  cropType: "corn",
  cropPrice: 4.70,
  acreage: 234,
  costPerAcre: 625,
  forecastLow: 140,
  forecastMid: 175,
  forecastHigh: 210,
};

// ── RP plan ───────────────────────────────────────────────────────────────────

describe("computeInsurance — RP plan", () => {
  it("yieldGuarantee = aphYield * coverageLevel (rounded to 1 decimal place)", () => {
    const result = computeInsurance(base);
    // 185 * 0.75 = 138.75 → Math.round(138.75 * 10) / 10 = 138.8
    expect(result.yieldGuarantee).toBe(Math.round(185 * 0.75 * 10) / 10);
  });

  it("revenueGuaranteePerAcre = aphYield * coverageLevel * projectedPrice", () => {
    const result = computeInsurance(base);
    // 185 * 0.75 * 4.70 = 651.375 → rounded to 2dp = 651.38
    expect(result.revenueGuaranteePerAcre).toBeCloseTo(185 * 0.75 * 4.70, 1);
  });

  it("totalLiability = revenueGuaranteePerAcre * acreage", () => {
    const result = computeInsurance(base);
    expect(result.totalLiability).toBeCloseTo((result.revenueGuaranteePerAcre ?? 0) * 234, 0);
  });

  it("returns 3 scenarios labelled Low / Mid / High in that order", () => {
    const result = computeInsurance(base);
    expect(result.scenarios[0].label).toBe("Low");
    expect(result.scenarios[1].label).toBe("Mid");
    expect(result.scenarios[2].label).toBe("High");
  });

  it("scenarios use the correct forecast yields", () => {
    const result = computeInsurance(base);
    expect(result.scenarios[0].forecastYield).toBe(140);
    expect(result.scenarios[1].forecastYield).toBe(175);
    expect(result.scenarios[2].forecastYield).toBe(210);
  });

  it("no indemnity when forecast yield produces revenue above the guarantee (high scenario)", () => {
    // High scenario: actualRevenue = 210 * 4.70 = $987/acre >> guarantee/acre $651.375
    const result = computeInsurance(base);
    expect(result.scenarios[2].indemnity).toBe(0);
  });

  it("indemnity > 0 when forecast yield is below the yield guarantee", () => {
    // Raise coverage to 0.85 so yieldGuarantee = 185 * 0.85 = 157.25 bu/acre
    // Low forecast 140 < 157.25 → loss
    // RP guarantee/acre = 185 * 0.85 * 4.70 = $739.075
    // actual revenue at low = 140 * 4.70 = $658/acre < $739.075 → indemnity > 0
    const result = computeInsurance({ ...base, coverageLevel: 0.85 });
    expect(result.scenarios[0].indemnity).toBeGreaterThan(0);
  });

  it("actualRevenue in each scenario = forecastYield * cropPrice * acreage", () => {
    const result = computeInsurance(base);
    for (const s of result.scenarios) {
      const expected = Math.round(s.forecastYield * base.cropPrice * base.acreage);
      expect(s.actualRevenue).toBe(expected);
    }
  });

  it("netPosition is computed when acreage, costPerAcre and cropPrice are all provided", () => {
    const result = computeInsurance(base);
    for (const s of result.scenarios) {
      expect(s.netPosition).not.toBeNull();
    }
  });

  it("netPosition is null when costPerAcre is not provided", () => {
    const result = computeInsurance({ ...base, costPerAcre: null });
    for (const s of result.scenarios) {
      expect(s.netPosition).toBeNull();
    }
  });
});

// ── RPHPE plan ────────────────────────────────────────────────────────────────

describe("computeInsurance — RPHPE plan (harvest price exclusion)", () => {
  it("revenueGuaranteePerAcre is not null (it is an RP-family plan)", () => {
    const result = computeInsurance({ ...base, planType: "RPHPE" });
    expect(result.revenueGuaranteePerAcre).not.toBeNull();
  });

  it("harvest price above projected price does NOT raise the RPHPE guarantee", () => {
    // RP: guarantee uses max(projected=4.70, harvest=6.00) = 6.00 → higher guarantee, more indemnity
    // RPHPE: guarantee uses only projected=4.70 → lower guarantee
    // At low forecast (140 bu), RP indemnity >= RPHPE indemnity
    const rpResult = computeInsurance({ ...base, planType: "RP", coverageLevel: 0.85, cropPrice: 6.00 });
    const rphpeResult = computeInsurance({ ...base, planType: "RPHPE", coverageLevel: 0.85, cropPrice: 6.00 });
    expect(rpResult.scenarios[0].indemnity).toBeGreaterThanOrEqual(rphpeResult.scenarios[0].indemnity);
  });

  it("with identical prices, RP and RPHPE produce the same indemnity", () => {
    // When projected == harvest, both plans produce the same guarantee
    const rpResult = computeInsurance({ ...base, planType: "RP", coverageLevel: 0.85 });
    const rphpeResult = computeInsurance({ ...base, planType: "RPHPE", coverageLevel: 0.85 });
    expect(rpResult.scenarios[0].indemnity).toBe(rphpeResult.scenarios[0].indemnity);
  });
});

// ── YP plan ───────────────────────────────────────────────────────────────────

describe("computeInsurance — YP plan (yield protection)", () => {
  it("revenueGuaranteePerAcre is null (yield-only plan has no revenue guarantee)", () => {
    const result = computeInsurance({ ...base, planType: "YP" });
    expect(result.revenueGuaranteePerAcre).toBeNull();
  });

  it("totalLiability is null (no revenue guarantee)", () => {
    const result = computeInsurance({ ...base, planType: "YP" });
    expect(result.totalLiability).toBeNull();
  });

  it("indemnity > 0 when actual yield is below the yield guarantee", () => {
    // YP with 0.85 coverage: yieldGuarantee = 185 * 0.85 = 157.25 bu/acre
    // low forecast = 140 < 157.25 → shortfall triggers indemnity
    const result = computeInsurance({ ...base, planType: "YP", coverageLevel: 0.85 });
    expect(result.scenarios[0].indemnity).toBeGreaterThan(0);
  });

  it("indemnity is 0 when actual yield exceeds the yield guarantee", () => {
    // YP with 0.75 coverage: yieldGuarantee = 185 * 0.75 = 138.75 bu/acre
    // High forecast = 210 > 138.75 → no payout
    const result = computeInsurance({ ...base, planType: "YP" });
    expect(result.scenarios[2].indemnity).toBe(0);
  });

  it("price election of 0.85 reduces YP indemnity vs price election of 1.00", () => {
    const fullElection = computeInsurance({ ...base, planType: "YP", coverageLevel: 0.85, priceElection: 1.00 });
    const partialElection = computeInsurance({ ...base, planType: "YP", coverageLevel: 0.85, priceElection: 0.85 });
    // Lower price election → lower indemnity per unit shortfall
    expect(partialElection.scenarios[0].indemnity).toBeLessThanOrEqual(fullElection.scenarios[0].indemnity);
  });
});

// ── Insurance status ──────────────────────────────────────────────────────────

describe("computeInsurance — status classification", () => {
  it("status is one of protected | partial | exposed", () => {
    const result = computeInsurance(base);
    expect(["protected", "partial", "exposed"]).toContain(result.status);
  });

  it("statusLabel, statusColor, and statusDetail are non-empty strings", () => {
    const result = computeInsurance(base);
    expect(result.statusLabel.length).toBeGreaterThan(0);
    expect(result.statusColor.length).toBeGreaterThan(0);
    expect(result.statusDetail.length).toBeGreaterThan(0);
  });

  it("without acreage, indemnity values are 0 (cannot calculate total payout)", () => {
    const result = computeInsurance({ ...base, acreage: null });
    for (const s of result.scenarios) {
      expect(s.indemnity).toBe(0);
    }
  });
});
