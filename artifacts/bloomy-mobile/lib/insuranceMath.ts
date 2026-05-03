/**
 * insuranceMath.ts
 *
 * Pure functions for U.S. Federal Crop Insurance calculations.
 *
 * Supported plan types (USDA Risk Management Agency):
 *  • RP   — Revenue Protection (most common for row crops)
 *           Guarantee = APH × coverage × max(projectedPrice, harvestPrice)
 *           Indemnity = max(0, guarantee − actual revenue) × acres
 *
 *  • RPHPE — Revenue Protection with Harvest Price Exclusion
 *           Same as RP but the guarantee uses only projectedPrice
 *           (harvest price cannot raise the guarantee)
 *
 *  • YP   — Yield Protection (yield-only)
 *           Yield guarantee = APH × coverage (bu/acre)
 *           Indemnity = max(0, yieldGuarantee − actualYield) × priceElection × projectedPrice × acres
 *
 * All monetary values are in USD. Yield values in crop-appropriate units (bu, lbs, cwt, tons).
 */

import { YIELD_PROFILES_PUBLIC } from "@/lib/yieldForecast";

// ── RMA projected prices (2025 crop year, USDA RMA) ────────────────────────

export const RMA_PROJECTED_PRICES_2025: Record<string, { price: number; label: string }> = {
  corn:         { price: 4.70,  label: "≈ $4.70/bu (RMA 2025)" },
  soybeans:     { price: 10.20, label: "≈ $10.20/bu (RMA 2025)" },
  winter_wheat: { price: 5.50,  label: "≈ $5.50/bu (RMA 2025)" },
  cotton:       { price: 0.70,  label: "≈ $0.70/lb (RMA 2025 seed cotton)" },
  rice:         { price: 14.30, label: "≈ $14.30/bu (RMA 2025)" },
};

// ── Coverage level options ──────────────────────────────────────────────────

export const COVERAGE_LEVELS = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85] as const;
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

export const PRICE_ELECTION_OPTIONS = [0.85, 0.90, 0.95, 1.00] as const;
export type PriceElection = (typeof PRICE_ELECTION_OPTIONS)[number];

export type InsurancePlanType = "RP" | "RPHPE" | "YP";

// ── Result types ────────────────────────────────────────────────────────────

export type InsuranceStatus = "protected" | "partial" | "exposed";

export interface InsuranceScenario {
  /** Forecast scenario label */
  label: "Low" | "Mid" | "High";
  /** Forecast yield used for this scenario (crop units/acre) */
  forecastYield: number;
  /** Actual revenue in this scenario (if price known) */
  actualRevenue: number | null;
  /** Insurance indemnity payout for this scenario */
  indemnity: number;
  /** Net farm position = profit_at_this_yield + indemnity (requires acreage + costPerAcre + cropPrice) */
  netPosition: number | null;
}

export interface InsuranceResult {
  planType: InsurancePlanType;
  aphYield: number;
  coverageLevel: number;
  projectedPrice: number;
  priceElection: number;
  unit: string;
  /** Yield guarantee in crop units per acre */
  yieldGuarantee: number;
  /** Revenue guarantee per acre (RP/RPHPE only) */
  revenueGuaranteePerAcre: number | null;
  /** Total revenue liability (guarantee × acres) */
  totalLiability: number | null;
  /** Three indemnity scenarios at low / mid / high forecast yield */
  scenarios: [InsuranceScenario, InsuranceScenario, InsuranceScenario];
  /** Overall protection status based on low-end scenario */
  status: InsuranceStatus;
  statusColor: string;
  statusLabel: string;
  statusDetail: string;
}

// ── Pure computation ────────────────────────────────────────────────────────

function calcIndemnityRP(params: {
  aph: number;
  coverageLevel: number;
  projectedPrice: number;
  harvestPrice: number; // use cropPrice as proxy for harvest price
  forecastYield: number;
  acreage: number;
}): number {
  const { aph, coverageLevel, projectedPrice, harvestPrice, forecastYield, acreage } = params;
  const guarantee = aph * coverageLevel * Math.max(projectedPrice, harvestPrice);
  const actualRevenue = forecastYield * harvestPrice;
  return Math.max(0, (guarantee - actualRevenue) * acreage);
}

function calcIndemnityRPHPE(params: {
  aph: number;
  coverageLevel: number;
  projectedPrice: number;
  harvestPrice: number;
  forecastYield: number;
  acreage: number;
}): number {
  const { aph, coverageLevel, projectedPrice, harvestPrice, forecastYield, acreage } = params;
  const guarantee = aph * coverageLevel * projectedPrice; // HPE: harvest price never raises guarantee
  const actualRevenue = forecastYield * harvestPrice;
  return Math.max(0, (guarantee - actualRevenue) * acreage);
}

function calcIndemnityYP(params: {
  aph: number;
  coverageLevel: number;
  projectedPrice: number;
  priceElection: number;
  forecastYield: number;
  acreage: number;
}): number {
  const { aph, coverageLevel, projectedPrice, priceElection, forecastYield, acreage } = params;
  const yieldGuarantee = aph * coverageLevel;
  return Math.max(0, (yieldGuarantee - forecastYield) * priceElection * projectedPrice * acreage);
}

function getIndemnity(
  planType: InsurancePlanType,
  aph: number,
  coverageLevel: number,
  projectedPrice: number,
  priceElection: number,
  harvestPrice: number,
  forecastYield: number,
  acreage: number
): number {
  switch (planType) {
    case "RP":
      return calcIndemnityRP({ aph, coverageLevel, projectedPrice, harvestPrice, forecastYield, acreage });
    case "RPHPE":
      return calcIndemnityRPHPE({ aph, coverageLevel, projectedPrice, harvestPrice, forecastYield, acreage });
    case "YP":
      return calcIndemnityYP({ aph, coverageLevel, projectedPrice, priceElection, forecastYield, acreage });
  }
}

export function computeInsurance(params: {
  planType: InsurancePlanType;
  aphYield: number;
  coverageLevel: number;
  projectedPrice: number;
  priceElection: number;
  cropType: string;
  /** Farmer's expected sale price — used as harvest price proxy */
  cropPrice: number | null | undefined;
  acreage: number | null | undefined;
  costPerAcre: number | null | undefined;
  /** From yield forecast */
  forecastLow: number;
  forecastMid: number;
  forecastHigh: number;
}): InsuranceResult {
  const {
    planType, aphYield, coverageLevel, projectedPrice, priceElection,
    cropType, cropPrice, acreage, costPerAcre,
    forecastLow, forecastMid, forecastHigh,
  } = params;

  const profile = YIELD_PROFILES_PUBLIC[cropType];
  const unit = profile?.unit ?? "units/acre";

  // Harvest price proxy — fall back to projectedPrice if farmer hasn't set market price
  const harvestPrice = cropPrice ?? projectedPrice;

  const yieldGuarantee = aphYield * coverageLevel;

  // Revenue guarantee per acre (only meaningful for RP/RPHPE)
  const revenueGuaranteePerAcre =
    planType === "RP" || planType === "RPHPE"
      ? Math.round(aphYield * coverageLevel * projectedPrice * 100) / 100
      : null;

  const totalLiability =
    revenueGuaranteePerAcre != null && acreage != null
      ? Math.round(revenueGuaranteePerAcre * acreage)
      : null;

  // Build scenarios
  const forecastValues: [number, "Low" | "Mid" | "High"][] = [
    [forecastLow, "Low"],
    [forecastMid, "Mid"],
    [forecastHigh, "High"],
  ];

  const scenarios = forecastValues.map(([yield_, label]) => {
    const indemnity = acreage
      ? Math.round(
          getIndemnity(planType, aphYield, coverageLevel, projectedPrice, priceElection, harvestPrice, yield_, acreage)
        )
      : 0;

    const actualRevenue =
      acreage != null ? Math.round(yield_ * harvestPrice * acreage) : null;

    // Net position: (yield * cropPrice - costPerAcre) * acreage + indemnity
    let netPosition: number | null = null;
    if (acreage != null && costPerAcre != null && cropPrice != null) {
      const grossRevenue = yield_ * cropPrice * acreage;
      const totalCost = costPerAcre * acreage;
      netPosition = Math.round(grossRevenue - totalCost + indemnity);
    }

    return { label, forecastYield: yield_, actualRevenue, indemnity, netPosition } as InsuranceScenario;
  }) as [InsuranceScenario, InsuranceScenario, InsuranceScenario];

  // Status based on whether the low-end scenario has meaningful coverage
  const lowIndemnity = scenarios[0].indemnity;
  const lowNetPos = scenarios[0].netPosition;
  let status: InsuranceStatus;
  if (lowNetPos != null) {
    status = lowNetPos >= 0 ? "protected" : lowNetPos >= -(costPerAcre ?? 0) * (acreage ?? 1) * 0.1 ? "partial" : "exposed";
  } else if (lowIndemnity > 0) {
    status = "partial";
  } else {
    status = "exposed";
  }

  const STATUS_META: Record<InsuranceStatus, { color: string; label: string; detail: string }> = {
    protected: {
      color: "#2D9B5A",
      label: "Fully protected",
      detail: "Even in a poor season the policy payout keeps your farm in the black.",
    },
    partial: {
      color: "#E8A020",
      label: "Partially protected",
      detail: "The policy softens losses but a bad season may still result in a net loss.",
    },
    exposed: {
      color: "#D02020",
      label: "Exposed to loss",
      detail: "At current coverage the policy may not prevent a net loss in a poor season. Consider raising your coverage level.",
    },
  };

  const meta = STATUS_META[status];

  return {
    planType,
    aphYield,
    coverageLevel,
    projectedPrice,
    priceElection,
    unit,
    yieldGuarantee: Math.round(yieldGuarantee * 10) / 10,
    revenueGuaranteePerAcre,
    totalLiability,
    scenarios,
    status,
    statusColor: meta.color,
    statusLabel: meta.label,
    statusDetail: meta.detail,
  };
}
