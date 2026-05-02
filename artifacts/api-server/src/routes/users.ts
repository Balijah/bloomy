import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, alertPreferencesTable } from "@workspace/db";
import { GetMeResponse, UpdateMeBody, UpdateMeResponse } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = (req as any).clerkUserId;

  const email = auth.sessionClaims?.email as string ?? "";
  const firstName = auth.sessionClaims?.firstName as string ?? null;
  const lastName = auth.sessionClaims?.lastName as string ?? null;

  const user = await getOrCreateUser(clerkUserId, email, firstName, lastName);

  let sub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, user.id)).limit(1);
  if (!sub[0]) {
    await db.insert(subscriptionsTable).values({ userId: user.id, tier: "free", status: "active" });
    sub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, user.id)).limit(1);
  }

  let prefs = await db.select().from(alertPreferencesTable).where(eq(alertPreferencesTable.userId, user.id)).limit(1);
  if (!prefs[0]) {
    await db.insert(alertPreferencesTable).values({ userId: user.id });
  }

  res.json(GetMeResponse.parse({
    ...user,
    subscriptionTier: sub[0]?.tier ?? "free",
  }));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ firstName: parsed.data.firstName ?? null, lastName: parsed.data.lastName ?? null })
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .returning();

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, existing.id)).limit(1);

  res.json(UpdateMeResponse.parse({
    ...updated,
    subscriptionTier: sub?.tier ?? "free",
  }));
});

export default router;
