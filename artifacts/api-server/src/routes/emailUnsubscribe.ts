import { Router, type IRouter } from "express";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, alertPreferencesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const HMAC_SECRET = process.env.HMAC_UNSUBSCRIBE_SECRET ?? process.env.CLERK_SECRET_KEY ?? "bloomy-unsubscribe-fallback";

export function generateUnsubscribeToken(userId: number): string {
  return createHmac("sha256", HMAC_SECRET).update(String(userId)).digest("hex");
}

export function buildUnsubscribeUrl(userId: number): string {
  const token = generateUnsubscribeToken(userId);
  const baseUrl = process.env.APP_URL ?? "";
  return `${baseUrl}/api/email/unsubscribe?uid=${userId}&token=${token}`;
}

router.get("/email/unsubscribe", async (req, res): Promise<void> => {
  const uid = Number(req.query.uid);
  const token = String(req.query.token ?? "");

  if (!uid || !token) {
    res.status(400).send(htmlPage("Invalid Link", "The unsubscribe link is invalid or incomplete."));
    return;
  }

  const expected = generateUnsubscribeToken(uid);
  if (token !== expected) {
    res.status(400).send(htmlPage("Invalid Link", "This unsubscribe link is invalid or has expired."));
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, uid)).limit(1);
  if (!user) {
    res.status(400).send(htmlPage("Not Found", "We couldn't find your account."));
    return;
  }

  await db
    .update(alertPreferencesTable)
    .set({ weeklyDigestEnabled: false, emailEnabled: false })
    .where(eq(alertPreferencesTable.userId, uid));

  logger.info({ userId: uid }, "User unsubscribed from digest emails via link");

  res.send(htmlPage(
    "Unsubscribed",
    "You've been unsubscribed from Bloomy weekly digest emails. You can re-enable notifications any time in Settings."
  ));
});

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Bloomy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAF8F5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1px solid #E8E4DF; border-radius: 12px; padding: 48px 32px; max-width: 440px; text-align: center; }
    h1 { color: #366441; margin: 0 0 12px; font-size: 24px; }
    p { color: #3A4A3A; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export default router;
