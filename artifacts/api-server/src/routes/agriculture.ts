import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, farmProfilesTable, locationsTable } from "@workspace/db";
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

  res.json(GetAgricultureInsightsResponse.parse({
    farmProfileId: profile.id,
    ...insights,
  }));
});

export default router;
