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
  const insights = computeAgricultureInsights(forecast, profile.cropType);

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

export default router;
