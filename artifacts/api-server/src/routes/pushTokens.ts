import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import { RegisterPushTokenBody, UnregisterPushTokenBody } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = (auth.sessionClaims?.email as string) ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

// Register (upsert) an Expo push token for the authenticated user's device.
router.post(
  "/notifications/push-token",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const parsed = RegisterPushTokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Upsert: insert if not exists, no-op if already registered
    await db
      .insert(pushTokensTable)
      .values({
        userId,
        token: parsed.data.token,
        platform: parsed.data.platform,
      })
      .onConflictDoNothing();

    res.sendStatus(204);
  }
);

// Remove a push token when the user signs out on this device.
router.delete(
  "/notifications/push-token",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const parsed = UnregisterPushTokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await db
      .delete(pushTokensTable)
      .where(
        and(
          eq(pushTokensTable.userId, userId),
          eq(pushTokensTable.token, parsed.data.token)
        )
      );

    res.sendStatus(204);
  }
);

export default router;
