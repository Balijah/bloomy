import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, farmProfilesTable, inputCostsTable } from "@workspace/db";
import {
  GetInputCostsParams,
  GetInputCostsResponse,
  CreateInputCostParams,
  CreateInputCostBody,
  UpdateInputCostParams,
  UpdateInputCostBody,
  UpdateInputCostResponse,
  DeleteInputCostParams,
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
  "/agriculture/farm-profiles/:id/input-costs",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = GetInputCostsParams.safeParse(req.params);
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
      .from(inputCostsTable)
      .where(
        and(
          eq(inputCostsTable.farmProfileId, params.data.id),
          eq(inputCostsTable.userId, userId)
        )
      )
      .orderBy(asc(inputCostsTable.category), asc(inputCostsTable.createdAt));

    res.json(GetInputCostsResponse.parse(rows));
  }
);

router.post(
  "/agriculture/farm-profiles/:id/input-costs",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = CreateInputCostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owned = await assertFarmOwnership(params.data.id, userId);
    if (!owned) {
      res.status(404).json({ error: "Farm profile not found" });
      return;
    }

    const body = CreateInputCostBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [record] = await db
      .insert(inputCostsTable)
      .values({
        farmProfileId: params.data.id,
        userId,
        category: body.data.category,
        item: body.data.item,
        costPerAcre: body.data.costPerAcre ?? null,
        totalCost: body.data.totalCost ?? null,
        acresApplied: body.data.acresApplied ?? null,
        date: body.data.date
          ? body.data.date instanceof Date
            ? body.data.date.toISOString().slice(0, 10)
            : String(body.data.date)
          : null,
        notes: body.data.notes ?? null,
      })
      .returning();

    res.status(201).json(record);
  }
);

router.put(
  "/agriculture/farm-profiles/:id/input-costs/:costId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = UpdateInputCostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = UpdateInputCostBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.category !== undefined) updateData.category = body.data.category;
    if (body.data.item !== undefined) updateData.item = body.data.item;
    if (body.data.costPerAcre !== undefined) updateData.costPerAcre = body.data.costPerAcre ?? null;
    if (body.data.totalCost !== undefined) updateData.totalCost = body.data.totalCost ?? null;
    if (body.data.acresApplied !== undefined) updateData.acresApplied = body.data.acresApplied ?? null;
    if (body.data.date !== undefined) {
      updateData.date = body.data.date
        ? body.data.date instanceof Date
          ? body.data.date.toISOString().slice(0, 10)
          : String(body.data.date)
        : null;
    }
    if (body.data.notes !== undefined) updateData.notes = body.data.notes ?? null;

    const [updated] = await db
      .update(inputCostsTable)
      .set(updateData as any)
      .where(
        and(
          eq(inputCostsTable.id, params.data.costId),
          eq(inputCostsTable.farmProfileId, params.data.id),
          eq(inputCostsTable.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Input cost record not found" });
      return;
    }
    res.json(UpdateInputCostResponse.parse(updated));
  }
);

router.delete(
  "/agriculture/farm-profiles/:id/input-costs/:costId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = DeleteInputCostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(inputCostsTable)
      .where(
        and(
          eq(inputCostsTable.id, params.data.costId),
          eq(inputCostsTable.farmProfileId, params.data.id),
          eq(inputCostsTable.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Input cost record not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
