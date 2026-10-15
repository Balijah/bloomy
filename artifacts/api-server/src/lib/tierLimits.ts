export interface TierLimits {
  maxLocations: number;
  maxFarmProfiles: number;
  forecastDays: number;
  hourlyForecast: boolean;
  agricultureInsights: boolean;
  sprayWindowAlerts: boolean;
  peakRiskAlerts: boolean;
  weeklyDigest: boolean;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxLocations: 1,
    maxFarmProfiles: 1,
    forecastDays: 7,
    hourlyForecast: false,
    agricultureInsights: false,
    sprayWindowAlerts: false,
    peakRiskAlerts: false,
    weeklyDigest: false,
  },
  grower: {
    maxLocations: 5,
    maxFarmProfiles: 10,
    forecastDays: 15,
    hourlyForecast: true,
    agricultureInsights: true,
    sprayWindowAlerts: true,
    peakRiskAlerts: true,
    weeklyDigest: true,
  },
  grower_pro: {
    maxLocations: 25,
    maxFarmProfiles: 50,
    forecastDays: 15,
    hourlyForecast: true,
    agricultureInsights: true,
    sprayWindowAlerts: true,
    peakRiskAlerts: true,
    weeklyDigest: true,
  },
};

export function getLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

/**
 * Free and unknown tiers never receive the weekly digest.
 * Paid users follow their preference. A missing preference counts as opted in,
 * matching the alert_preferences.weekly_digest_enabled default.
 */
export function receivesWeeklyDigest(
  tier: string | null | undefined,
  weeklyDigestEnabled: boolean | undefined,
): boolean {
  if (!getLimits(tier ?? "free").weeklyDigest) return false;
  return weeklyDigestEnabled !== false;
}
