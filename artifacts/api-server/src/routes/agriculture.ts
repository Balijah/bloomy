import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, farmProfilesTable, locationsTable, alertsTable } from "@workspace/db";
import {
  GetFarmProfilesResponse,
  GetFarmProfileParams,
  GetFarmProfileResponse,
  CreateFarmProfileBody,
  UpdateFarmProfileParams,
  UpdateFarmProfileBody,
  UpdateFarmProfileResponse,
  DeleteFarmProfileParams,
  GetAgricultureInsightsParams,
  GetAgricultureInsightsResponse,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { fetchForecast, computeAgricultureInsights } from "../lib/weather";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

router.get("/agriculture/farm-profiles", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const rows = await db.select().from(farmProfilesTable).where(eq(farmProfilesTable.userId, userId));
  res.json(GetFarmProfilesResponse.parse(rows));
});

router.post("/agriculture/farm-profiles", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const parsed = CreateFarmProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [loc] = await db.select().from(locationsTable)
    .where(and(eq(locationsTable.id, parsed.data.locationId), eq(locationsTable.userId, userId)));
  if (!loc) {
    res.status(400).json({ error: "Location not found or does not belong to user" });
    return;
  }

  const [profile] = await db.insert(farmProfilesTable).values({
    name: parsed.data.name,
    cropType: parsed.data.cropType,
    locationId: parsed.data.locationId,
    userId,
    acreage: parsed.data.acreage ?? null,
    soilType: parsed.data.soilType ?? null,
    plantingDate: parsed.data.plantingDate ? String(parsed.data.plantingDate) : null,
    harvestDate: parsed.data.harvestDate ? String(parsed.data.harvestDate) : null,
    yieldGoal: parsed.data.yieldGoal ?? null,
    cropPrice: parsed.data.cropPrice ?? null,
    costPerAcre: parsed.data.costPerAcre ?? null,
    aphYield: parsed.data.aphYield ?? null,
    insurancePlanType: parsed.data.insurancePlanType ?? null,
    coverageLevel: parsed.data.coverageLevel ?? null,
    projectedPrice: parsed.data.projectedPrice ?? null,
    priceElection: parsed.data.priceElection ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json(GetFarmProfileResponse.parse(profile));
});

router.get("/agriculture/farm-profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = GetFarmProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db.select().from(farmProfilesTable)
    .where(and(eq(farmProfilesTable.id, params.data.id), eq(farmProfilesTable.userId, userId)));
  if (!profile) {
    res.status(404).json({ error: "Farm profile not found" });
    return;
  }
  res.json(GetFarmProfileResponse.parse(profile));
});

router.patch("/agriculture/farm-profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = UpdateFarmProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFarmProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.cropType !== undefined) updateData.cropType = parsed.data.cropType;
  if (parsed.data.acreage !== undefined) updateData.acreage = parsed.data.acreage ?? null;
  if (parsed.data.soilType !== undefined) updateData.soilType = parsed.data.soilType ?? null;
  if (parsed.data.plantingDate !== undefined) updateData.plantingDate = parsed.data.plantingDate ? String(parsed.data.plantingDate) : null;
  if (parsed.data.harvestDate !== undefined) updateData.harvestDate = parsed.data.harvestDate ? String(parsed.data.harvestDate) : null;
  if (parsed.data.yieldGoal !== undefined) updateData.yieldGoal = parsed.data.yieldGoal ?? null;
  if (parsed.data.cropPrice !== undefined) updateData.cropPrice = parsed.data.cropPrice ?? null;
  if (parsed.data.costPerAcre !== undefined) updateData.costPerAcre = parsed.data.costPerAcre ?? null;
  if (parsed.data.aphYield !== undefined) updateData.aphYield = parsed.data.aphYield ?? null;
  if (parsed.data.insurancePlanType !== undefined) updateData.insurancePlanType = parsed.data.insurancePlanType ?? null;
  if (parsed.data.coverageLevel !== undefined) updateData.coverageLevel = parsed.data.coverageLevel ?? null;
  if (parsed.data.projectedPrice !== undefined) updateData.projectedPrice = parsed.data.projectedPrice ?? null;
  if (parsed.data.priceElection !== undefined) updateData.priceElection = parsed.data.priceElection ?? null;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;

  const [updated] = await db.update(farmProfilesTable)
    .set(updateData as any)
    .where(and(eq(farmProfilesTable.id, params.data.id), eq(farmProfilesTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Farm profile not found" });
    return;
  }
  res.json(UpdateFarmProfileResponse.parse(updated));
});

router.delete("/agriculture/farm-profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = DeleteFarmProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(farmProfilesTable)
    .where(and(eq(farmProfilesTable.id, params.data.id), eq(farmProfilesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Farm profile not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/agriculture/weekly-digest", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [farms, weekAlerts] = await Promise.all([
    db.select().from(farmProfilesTable).where(eq(farmProfilesTable.userId, userId)),
    db.select().from(alertsTable).where(
      and(
        eq(alertsTable.userId, userId),
        gte(alertsTable.triggeredAt, weekAgo)
      )
    ),
  ]);

  const farmDigests = farms.map((farm) => {
    const farmAlerts = weekAlerts.filter((a) => a.farmProfileId === farm.id);
    const criticalRiskTypes = [
      ...new Set(
        farmAlerts
          .filter((a) => a.severity === "critical" || a.severity === "warning")
          .map((a) => a.type)
      ),
    ];
    return {
      id: farm.id,
      name: farm.name,
      cropType: farm.cropType,
      weeklyAlertCount: farmAlerts.length,
      criticalRiskTypes,
    };
  });

  res.json({
    farms: farmDigests,
    totalAlerts: weekAlerts.length,
    generatedAt: new Date().toISOString(),
  });
});

router.get("/agriculture/insights/:farmProfileId", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = GetAgricultureInsightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db.select().from(farmProfilesTable)
    .where(and(eq(farmProfilesTable.id, params.data.farmProfileId), eq(farmProfilesTable.userId, userId)));
  if (!profile) {
    res.status(404).json({ error: "Farm profile not found" });
    return;
  }

  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, profile.locationId));
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }

  const forecast = await fetchForecast(loc.lat, loc.lng);
  const insights = computeAgricultureInsights(forecast, profile.cropType, profile.plantingDate);

  // ── Farm risk alerts ──────────────────────────────────────────────────────
  // For critical/high risk conditions, create an alert record so the
  // background notification task picks it up automatically.
  // Throttled to one alert per risk type per farm per 12 hours.
  const THROTTLE_MS = 12 * 60 * 60 * 1000;
  const throttleFrom = new Date(Date.now() - THROTTLE_MS);

  type RiskLevel = { level: string; description: string } | undefined | null;
  const riskMap: Array<{
    risk: RiskLevel;
    type: "frost" | "heat_stress" | "drought" | "harvest_disruption";
    title: (farmName: string) => string;
  }> = [
    {
      risk: insights.frostRisk as RiskLevel,
      type: "frost",
      title: (n) => `Frost Risk — ${n}`,
    },
    {
      risk: insights.heatStressRisk as RiskLevel,
      type: "heat_stress",
      title: (n) => `Heat Stress — ${n}`,
    },
    {
      risk: insights.droughtRisk as RiskLevel,
      type: "drought",
      title: (n) => `Drought Risk — ${n}`,
    },
    {
      risk: insights.harvestDisruptionRisk as RiskLevel,
      type: "harvest_disruption",
      title: (n) => `Harvest Disruption — ${n}`,
    },
  ];

  const RISK_TO_SEVERITY: Record<string, "watch" | "warning" | "critical"> = {
    critical: "critical",
    high:     "warning",
    moderate: "watch",
  };

  // Run alert creation in the background — don't block the response
  (async () => {
    try {
      for (const { risk, type, title } of riskMap) {
        if (!risk) continue;
        const level = risk.level?.toLowerCase();
        const severity = RISK_TO_SEVERITY[level];
        if (!severity) continue; // skip "low" / "none"

        // Check if a recent unread alert of this type already exists for this farm
        const recent = await db
          .select({ id: alertsTable.id })
          .from(alertsTable)
          .where(
            and(
              eq(alertsTable.userId, userId),
              eq(alertsTable.farmProfileId, profile.id),
              eq(alertsTable.type, type),
              eq(alertsTable.isRead, false),
              gte(alertsTable.triggeredAt, throttleFrom)
            )
          )
          .limit(1);

        if (recent.length > 0) continue; // already notified recently

        await db.insert(alertsTable).values({
          userId,
          farmProfileId: profile.id,
          locationId: profile.locationId,
          type,
          severity,
          title: title(profile.name),
          message: risk.description,
          isRead: false,
          expiresAt: new Date(Date.now() + THROTTLE_MS * 2),
        });
      }
    } catch {
      // Non-critical — never fail the request due to alert creation
    }
  })();

  res.json(GetAgricultureInsightsResponse.parse({
    farmProfileId: profile.id,
    ...insights,
  }));
});

// ─── Spray window alerts endpoint ────────────────────────────────────────────
// Returns farms with ideal/good spray conditions in the next 48 hours so the
// mobile background task can fire timely notifications without re-running the
// full SprayWindowCard logic on-device.

type SprayRating = "ideal" | "good";

interface DayForecast {
  date: string;
  windSpeedMax: number;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  precipitationProbability: number;
}

function scoreDayForSpray(d: DayForecast): SprayRating | null {
  // Hard excludes
  if (
    d.tempMin <= 32 ||
    d.windSpeedMax > 20 ||
    d.precipitationProbability >= 65 ||
    d.precipitation >= 0.25 ||
    d.tempMax >= 95
  )
    return null;

  const idealWind  = d.windSpeedMax >= 3  && d.windSpeedMax <= 10;
  const idealTemp  = d.tempMax >= 55 && d.tempMax <= 85 && d.tempMin > 40;
  const idealPrec  = d.precipitationProbability < 25 && d.precipitation < 0.05;
  if (idealWind && idealTemp && idealPrec) return "ideal";

  const goodWind   = d.windSpeedMax >= 2  && d.windSpeedMax <= 15;
  const goodTemp   = d.tempMax >= 45 && d.tempMax <= 90;
  const goodPrec   = d.precipitationProbability < 40 && d.precipitation < 0.1;
  if (goodWind && goodTemp && goodPrec) return "good";

  return null;
}

function dayLabel(date: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return target.toLocaleDateString("en-US", { weekday: "long" });
}

router.get("/agriculture/spray-window-alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);

  const farms = await db
    .select()
    .from(farmProfilesTable)
    .where(eq(farmProfilesTable.userId, userId));

  if (!farms.length) {
    res.json({ upcomingWindows: [] });
    return;
  }

  // Fetch location for each farm (deduplicated by locationId)
  const locationIds = [...new Set(farms.map((f) => f.locationId))];
  const locs = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.userId, userId));

  const locMap = Object.fromEntries(locs.map((l) => [l.id, l]));

  // Fetch forecasts in parallel (one per unique location)
  const forecastByLocationId: Record<number, Awaited<ReturnType<typeof fetchForecast>>> = {};
  await Promise.all(
    locationIds.map(async (lid) => {
      const loc = locMap[lid];
      if (!loc) return;
      try {
        forecastByLocationId[lid] = await fetchForecast(loc.lat, loc.lng);
      } catch {
        // skip farms whose forecast fails
      }
    })
  );

  // Score the next 2 days for each farm
  const upcomingWindows: {
    farmId: number;
    farmName: string;
    cropType: string;
    date: string;
    dayLabel: string;
    rating: SprayRating;
    windSpeed: number;
    tempMax: number;
    tempMin: number;
    precipProbability: number;
  }[] = [];

  for (const farm of farms) {
    const forecast = forecastByLocationId[farm.locationId];
    if (!forecast) continue;

    const next2 = forecast.slice(0, 2);
    for (const day of next2) {
      const rating = scoreDayForSpray(day as DayForecast);
      if (!rating) continue;
      upcomingWindows.push({
        farmId:         farm.id,
        farmName:       farm.name,
        cropType:       farm.cropType,
        date:           day.date,
        dayLabel:       dayLabel(day.date),
        rating,
        windSpeed:      Math.round((day as any).windSpeedMax),
        tempMax:        Math.round((day as any).tempMax),
        tempMin:        Math.round((day as any).tempMin),
        precipProbability: (day as any).precipitationProbability,
      });
    }
  }

  res.json({ upcomingWindows });
});

// ─── Peak risk alerts ─────────────────────────────────────────────────────────
// Returns high/critical risk days for each farm (next 3 days) so the mobile
// background task can fire targeted push notifications.

function peakRiskDayLabel(dateStr: string, idx: number, isNight: boolean): string {
  if (idx === 0) return isNight ? "tonight" : "today";
  if (idx === 1) return isNight ? "tomorrow night" : "tomorrow";
  const d = new Date(dateStr + "T12:00:00Z");
  const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return isNight ? `${name} night` : name;
}

router.get("/agriculture/peak-risk-alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);

  const farms = await db
    .select()
    .from(farmProfilesTable)
    .where(eq(farmProfilesTable.userId, userId));

  if (!farms.length) {
    res.json({ alerts: [] });
    return;
  }

  const locationIds = [...new Set(farms.map((f) => f.locationId))];
  const locs = await db.select().from(locationsTable).where(eq(locationsTable.userId, userId));
  const locMap = Object.fromEntries(locs.map((l) => [l.id, l]));

  const forecastByLocationId: Record<number, Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    precipitationProbability: number;
  }>> = {};

  await Promise.all(
    locationIds.map(async (lid) => {
      const loc = locMap[lid];
      if (!loc) return;
      try {
        forecastByLocationId[lid] = await fetchForecast(loc.lat, loc.lng) as any;
      } catch {
        // skip farms whose forecast fails
      }
    })
  );

  type PeakRiskEntry = {
    farmId: number;
    farmName: string;
    cropType: string;
    riskType: "frost" | "heat" | "drought";
    peakDate: string;
    dayLabel: string;
    severity: "high" | "critical";
    peakValue: number;
    sentence: string;
    recommendation: string;
  };

  const alerts: PeakRiskEntry[] = [];

  for (const farm of farms) {
    const forecast = forecastByLocationId[farm.locationId];
    if (!forecast) continue;
    const next3 = forecast.slice(0, 3);

    // Frost — notify for high (< 32°F) and critical (< 28°F) only
    let worstFrostIdx = -1;
    let worstTempMin = Infinity;
    next3.forEach((day, i) => {
      if (day.tempMin < 32 && day.tempMin < worstTempMin) {
        worstTempMin = day.tempMin;
        worstFrostIdx = i;
      }
    });
    if (worstFrostIdx >= 0) {
      const severity: "high" | "critical" = worstTempMin < 28 ? "critical" : "high";
      const dl = peakRiskDayLabel(next3[worstFrostIdx].date, worstFrostIdx, true);
      const pv = Math.round(worstTempMin);
      alerts.push({
        farmId: farm.id, farmName: farm.name, cropType: farm.cropType,
        riskType: "frost", peakDate: next3[worstFrostIdx].date, dayLabel: dl,
        severity, peakValue: pv,
        sentence: `Frost risk peaks ${dl} (${pv}°F low)`,
        recommendation: severity === "critical"
          ? `Move potted plants indoors and cover all sensitive crops ${dl} — hard freeze expected.`
          : `Cover frost-sensitive crops ${dl} before temperatures drop below freezing.`,
      });
    }

    // Heat — notify for high (> 100°F) and critical (> 108°F) only
    let worstHeatIdx = -1;
    let worstTempMax = -Infinity;
    next3.forEach((day, i) => {
      if (day.tempMax > 100 && day.tempMax > worstTempMax) {
        worstTempMax = day.tempMax;
        worstHeatIdx = i;
      }
    });
    if (worstHeatIdx >= 0) {
      const severity: "high" | "critical" = worstTempMax > 108 ? "critical" : "high";
      const dl = peakRiskDayLabel(next3[worstHeatIdx].date, worstHeatIdx, false);
      const pv = Math.round(worstTempMax);
      alerts.push({
        farmId: farm.id, farmName: farm.name, cropType: farm.cropType,
        riskType: "heat", peakDate: next3[worstHeatIdx].date, dayLabel: dl,
        severity, peakValue: pv,
        sentence: `Heat stress peaks ${dl} (${pv}°F high)`,
        recommendation: severity === "critical"
          ? `Maximize irrigation ${dl} and delay field operations until temperatures ease.`
          : `Increase irrigation frequency and avoid midday field work ${dl}.`,
      });
    }

    // Drought — notify for high (< 15%) and critical (< 5%) only
    let worstDroughtIdx = -1;
    let worstPrecip = Infinity;
    next3.forEach((day, i) => {
      if (day.precipitationProbability < 15 && day.precipitationProbability < worstPrecip) {
        worstPrecip = day.precipitationProbability;
        worstDroughtIdx = i;
      }
    });
    if (worstDroughtIdx >= 0) {
      const severity: "high" | "critical" = worstPrecip < 5 ? "critical" : "high";
      const dl = peakRiskDayLabel(next3[worstDroughtIdx].date, worstDroughtIdx, false);
      const pv = Math.round(worstPrecip);
      alerts.push({
        farmId: farm.id, farmName: farm.name, cropType: farm.cropType,
        riskType: "drought", peakDate: next3[worstDroughtIdx].date, dayLabel: dl,
        severity, peakValue: pv,
        sentence: `Driest day is ${dl} (${pv}% chance of rain)`,
        recommendation: severity === "critical"
          ? `Irrigate now — virtually no rainfall expected through ${dl}.`
          : `Plan an irrigation cycle before ${dl} to maintain crop health.`,
      });
    }
  }

  res.json({ alerts });
});

export default router;
