import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, locationsTable, usersTable, subscriptionsTable } from "@workspace/db";
import {
  GetLocationsResponse,
  GetLocationParams,
  GetLocationResponse,
  CreateLocationBody,
  UpdateLocationParams,
  UpdateLocationBody,
  UpdateLocationResponse,
  DeleteLocationParams,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const clerkUserId = req.clerkUserId;
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser(clerkUserId, email);
  return user.id;
}

router.get("/locations", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const rows = await db.select().from(locationsTable).where(eq(locationsTable.userId, userId));
  res.json(GetLocationsResponse.parse(rows));
});

router.post("/locations", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);

  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  const tier = sub?.tier ?? "free";

  if (tier === "free") {
    const existing = await db.select().from(locationsTable).where(eq(locationsTable.userId, userId));
    if (existing.length >= 1) {
      res.status(403).json({ error: "Free tier allows 1 location. Upgrade to Grower for more." });
      return;
    }
  }

  if (parsed.data.isDefault) {
    await db.update(locationsTable).set({ isDefault: false }).where(eq(locationsTable.userId, userId));
  }

  const existing = await db.select().from(locationsTable).where(eq(locationsTable.userId, userId));
  const isDefault = existing.length === 0 ? true : (parsed.data.isDefault ?? false);

  const [loc] = await db.insert(locationsTable).values({
    ...parsed.data,
    userId,
    isDefault,
  }).returning();

  res.status(201).json(GetLocationResponse.parse(loc));
});

router.get("/locations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = GetLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [loc] = await db.select().from(locationsTable)
    .where(and(eq(locationsTable.id, params.data.id), eq(locationsTable.userId, userId)));
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(GetLocationResponse.parse(loc));
});

router.patch("/locations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = UpdateLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.isDefault) {
    await db.update(locationsTable).set({ isDefault: false }).where(eq(locationsTable.userId, userId));
  }

  const [updated] = await db.update(locationsTable)
    .set(parsed.data)
    .where(and(eq(locationsTable.id, params.data.id), eq(locationsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(UpdateLocationResponse.parse(updated));
});

router.delete("/locations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = DeleteLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(locationsTable)
    .where(and(eq(locationsTable.id, params.data.id), eq(locationsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
