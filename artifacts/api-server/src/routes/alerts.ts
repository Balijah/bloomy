import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, alertsTable, alertPreferencesTable } from "@workspace/db";
import {
  GetAlertsQueryParams,
  GetAlertsResponse,
  GetActiveAlertsResponse,
  MarkAlertReadParams,
  MarkAlertReadResponse,
  DeleteAlertParams,
  GetAlertPreferencesResponse,
  UpdateAlertPreferencesBody,
  UpdateAlertPreferencesResponse,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

router.get("/alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = GetAlertsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(alertsTable).where(eq(alertsTable.userId, userId)).orderBy(desc(alertsTable.triggeredAt)).$dynamic();

  const rows = await query;
  const filtered = params.data.unreadOnly ? rows.filter(r => !r.isRead) : rows;
  res.json(GetAlertsResponse.parse(filtered));
});

router.get("/alerts/active", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const rows = await db.select().from(alertsTable)
    .where(and(eq(alertsTable.userId, userId), eq(alertsTable.isRead, false)))
    .orderBy(desc(alertsTable.triggeredAt));
  res.json(GetActiveAlertsResponse.parse(rows));
});

router.patch("/alerts/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = MarkAlertReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db.update(alertsTable)
    .set({ isRead: true })
    .where(and(eq(alertsTable.id, params.data.id), eq(alertsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(MarkAlertReadResponse.parse(updated));
});

router.delete("/alerts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const params = DeleteAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(alertsTable)
    .where(and(eq(alertsTable.id, params.data.id), eq(alertsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/alert-preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  let [prefs] = await db.select().from(alertPreferencesTable).where(eq(alertPreferencesTable.userId, userId)).limit(1);
  if (!prefs) {
    await db.insert(alertPreferencesTable).values({ userId });
    [prefs] = await db.select().from(alertPreferencesTable).where(eq(alertPreferencesTable.userId, userId)).limit(1);
  }
  res.json(GetAlertPreferencesResponse.parse(prefs));
});

router.put("/alert-preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  const parsed = UpdateAlertPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let [prefs] = await db.select().from(alertPreferencesTable).where(eq(alertPreferencesTable.userId, userId)).limit(1);
  if (!prefs) {
    await db.insert(alertPreferencesTable).values({ userId });
  }

  const updateData: any = {};
  if (parsed.data.emailEnabled !== undefined) updateData.emailEnabled = parsed.data.emailEnabled;
  if (parsed.data.alertTypes !== undefined) updateData.alertTypes = parsed.data.alertTypes;
  if (parsed.data.frostThreshold !== undefined) updateData.frostThreshold = parsed.data.frostThreshold;
  if (parsed.data.heatThreshold !== undefined) updateData.heatThreshold = parsed.data.heatThreshold;
  if (parsed.data.precipThreshold !== undefined) updateData.precipThreshold = parsed.data.precipThreshold;
  if (parsed.data.windThreshold !== undefined) updateData.windThreshold = parsed.data.windThreshold;

  const [updated] = await db.update(alertPreferencesTable)
    .set(updateData)
    .where(eq(alertPreferencesTable.userId, userId))
    .returning();

  res.json(UpdateAlertPreferencesResponse.parse(updated));
});

export default router;
