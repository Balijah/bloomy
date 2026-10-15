import { describe, it, expect } from "vitest";
import { getLimits, TIER_LIMITS } from "../lib/tierLimits";

describe("tierLimits", () => {
  it("returns free tier limits by default", () => {
    const limits = getLimits("free");
    expect(limits.maxLocations).toBe(1);
    expect(limits.maxFarmProfiles).toBe(1);
    expect(limits.forecastDays).toBe(7);
    expect(limits.hourlyForecast).toBe(false);
    expect(limits.agricultureInsights).toBe(false);
  });

  it("returns grower tier limits", () => {
    const limits = getLimits("grower");
    expect(limits.maxLocations).toBe(5);
    expect(limits.maxFarmProfiles).toBe(10);
    expect(limits.forecastDays).toBe(15);
    expect(limits.hourlyForecast).toBe(true);
    expect(limits.agricultureInsights).toBe(true);
  });

  it("returns grower_pro tier limits", () => {
    const limits = getLimits("grower_pro");
    expect(limits.maxLocations).toBe(25);
    expect(limits.maxFarmProfiles).toBe(50);
    expect(limits.forecastDays).toBe(15);
    expect(limits.hourlyForecast).toBe(true);
  });

  it("falls back to free for unknown tiers", () => {
    const limits = getLimits("nonexistent");
    expect(limits).toEqual(TIER_LIMITS.free);
  });

  it("free tier denies paid features", () => {
    const limits = getLimits("free");
    expect(limits.hourlyForecast).toBe(false);
    expect(limits.agricultureInsights).toBe(false);
    expect(limits.sprayWindowAlerts).toBe(false);
    expect(limits.peakRiskAlerts).toBe(false);
    expect(limits.weeklyDigest).toBe(false);
  });

  it("paid tiers enable all features", () => {
    for (const tier of ["grower", "grower_pro"]) {
      const limits = getLimits(tier);
      expect(limits.hourlyForecast).toBe(true);
      expect(limits.agricultureInsights).toBe(true);
      expect(limits.sprayWindowAlerts).toBe(true);
      expect(limits.peakRiskAlerts).toBe(true);
      expect(limits.weeklyDigest).toBe(true);
    }
  });
});
