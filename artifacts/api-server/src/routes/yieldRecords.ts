import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, farmProfilesTable, yieldRecordsTable } from "@workspace/db";
import {
  GetYieldRecordsParams,
  GetYieldRecordsResponse,
  CreateYieldRecordParams,
  CreateYieldRecordBody,
  UpdateYieldRecordParams,
  UpdateYieldRecordBody,
  UpdateYieldRecordResponse,
  DeleteYieldRecordParams,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = (auth.sessionClaims?.email as string) ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

async function assertFarmOwnership(
  farmProfileId: number,
  userId: number
): Promise<boolean> {
  const [profile] = await db
    .select({ id: farmProfilesTable.id })
    .from(farmProfilesTable)
    .where(
      and(
        eq(farmProfilesTable.id, farmProfileId),
        eq(farmProfilesTable.userId, userId)
      )
    );
  return !!profile;
}

router.get(
  "/agriculture/farm-profiles/:id/yield-records",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = GetYieldRecordsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owned = await assertFarmOwnership(params.data.id, userId);
    if (!owned) {
      res.status(404).json({ error: "Farm profile not found" });
      return;
    }

    const rows = await db
      .select()
      .from(yieldRecordsTable)
      .where(
        and(
          eq(yieldRecordsTable.farmProfileId, params.data.id),
          eq(yieldRecordsTable.userId, userId)
        )
      )
      .orderBy(asc(yieldRecordsTable.harvestYear));

    res.json(GetYieldRecordsResponse.parse(rows));
  }
);

router.post(
  "/agriculture/farm-profiles/:id/yield-records",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = CreateYieldRecordParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owned = await assertFarmOwnership(params.data.id, userId);
    if (!owned) {
      res.status(404).json({ error: "Farm profile not found" });
      return;
    }

    const body = CreateYieldRecordBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [record] = await db
      .insert(yieldRecordsTable)
      .values({
        farmProfileId: params.data.id,
        userId,
        harvestYear: body.data.harvestYear,
        actualYield: body.data.actualYield,
        notes: body.data.notes ?? null,
      })
      .returning();

    res.status(201).json(record);
  }
);

router.put(
  "/agriculture/farm-profiles/:id/yield-records/:recordId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = UpdateYieldRecordParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = UpdateYieldRecordBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.actualYield !== undefined)
      updateData.actualYield = body.data.actualYield;
    if (body.data.notes !== undefined)
      updateData.notes = body.data.notes ?? null;

    const [updated] = await db
      .update(yieldRecordsTable)
      .set(updateData as any)
      .where(
        and(
          eq(yieldRecordsTable.id, params.data.recordId),
          eq(yieldRecordsTable.farmProfileId, params.data.id),
          eq(yieldRecordsTable.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Yield record not found" });
      return;
    }
    res.json(UpdateYieldRecordResponse.parse(updated));
  }
);

router.delete(
  "/agriculture/farm-profiles/:id/yield-records/:recordId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = DeleteYieldRecordParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(yieldRecordsTable)
      .where(
        and(
          eq(yieldRecordsTable.id, params.data.recordId),
          eq(yieldRecordsTable.farmProfileId, params.data.id),
          eq(yieldRecordsTable.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Yield record not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
