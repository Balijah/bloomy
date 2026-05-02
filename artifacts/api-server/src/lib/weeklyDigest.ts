/**
 * Weekly farm digest — sent every Sunday at 7 PM UTC via Expo Push.
 *
 * For each user who has at least one registered push token the worker:
 *   1. Counts their active farms
 *   2. Looks up recent (last 7 days) critical/high weather alerts
 *   3. Looks up open critical/high scouting notes (last 30 days)
 *   4. Builds a concise push notification and sends it
 *
 * No live weather API calls are made — all data comes from existing DB rows
 * so the cron never blocks on slow external requests.
 */

import cron from "node-cron";
import Expo, { type ExpoPushMessage } from "expo-server-sdk";
import { db, farmProfilesTable, pushTokensTable, alertsTable, fieldNotesTable } from "@workspace/db";
import { eq, and, gte, inArray, or } from "drizzle-orm";
import { logger } from "./logger";

const expo = new Expo();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function thirtyDaysAgo(): Date {
  function pad(n: number) { return String(n).padStart(2, "0"); }
  const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return d;
}

function isoDateOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Core digest logic ─────────────────────────────────────────────────────────

async function sendWeeklyDigests(): Promise<void> {
  logger.info("Weekly digest: starting run");

  // 1. Collect all distinct users who have push tokens
  const tokenRows = await db
    .select({
      userId: pushTokensTable.userId,
      token: pushTokensTable.token,
    })
    .from(pushTokensTable);

  if (tokenRows.length === 0) {
    logger.info("Weekly digest: no registered push tokens — skipping");
    return;
  }

  // Group tokens by userId
  const userTokenMap = new Map<number, string[]>();
  for (const row of tokenRows) {
    const existing = userTokenMap.get(row.userId) ?? [];
    existing.push(row.token);
    userTokenMap.set(row.userId, existing);
  }

  const userIds = [...userTokenMap.keys()];

  // 2. Fetch farms for these users
  const farms = await db
    .select()
    .from(farmProfilesTable)
    .where(inArray(farmProfilesTable.userId, userIds));

  // Group farms by userId
  const farmsByUser = new Map<number, typeof farms>();
  for (const farm of farms) {
    const arr = farmsByUser.get(farm.userId) ?? [];
    arr.push(farm);
    farmsByUser.set(farm.userId, arr);
  }

  const farmIds = farms.map((f) => f.id);
  if (farmIds.length === 0) {
    logger.info("Weekly digest: no farms found for token users");
    return;
  }

  // 3. Recent critical/high alerts (last 7 days)
  const recentAlerts = await db
    .select({
      farmProfileId: alertsTable.farmProfileId,
      userId: alertsTable.userId,
      severity: alertsTable.severity,
      type: alertsTable.type,
    })
    .from(alertsTable)
    .where(
      and(
        inArray(alertsTable.userId, userIds),
        gte(alertsTable.triggeredAt, sevenDaysAgo()),
        or(
          eq(alertsTable.severity, "critical"),
          eq(alertsTable.severity, "warning")
        )
      )
    );

  // Group alerts by userId
  const alertsByUser = new Map<number, typeof recentAlerts>();
  for (const alert of recentAlerts) {
    const arr = alertsByUser.get(alert.userId) ?? [];
    arr.push(alert);
    alertsByUser.set(alert.userId, arr);
  }

  // 4. Critical/high scouting notes from last 30 days
  const thirtyAgoIso = isoDateOf(thirtyDaysAgo());
  const criticalNotes = await db
    .select({
      farmProfileId: fieldNotesTable.farmProfileId,
      userId: fieldNotesTable.userId,
      severity: fieldNotesTable.severity,
      title: fieldNotesTable.title,
      category: fieldNotesTable.category,
    })
    .from(fieldNotesTable)
    .where(
      and(
        inArray(fieldNotesTable.userId, userIds),
        or(
          eq(fieldNotesTable.severity, "critical"),
          eq(fieldNotesTable.severity, "high")
        ),
        gte(fieldNotesTable.date, thirtyAgoIso)
      )
    );

  // Group critical notes by userId
  const notesByUser = new Map<number, typeof criticalNotes>();
  for (const note of criticalNotes) {
    const arr = notesByUser.get(note.userId) ?? [];
    arr.push(note);
    notesByUser.set(note.userId, arr);
  }

  // 5. Build and send messages per user
  const messages: ExpoPushMessage[] = [];
  const badTokens: string[] = [];

  for (const [userId, tokens] of userTokenMap.entries()) {
    const userFarms = farmsByUser.get(userId) ?? [];
    if (userFarms.length === 0) continue; // no farms — skip

    const userAlerts = alertsByUser.get(userId) ?? [];
    const userNotes = notesByUser.get(userId) ?? [];

    // Build notification text
    const farmCount = userFarms.length;
    const alertCount = userAlerts.length;
    const noteCount = userNotes.length;

    let title: string;
    let body: string;
    let data: Record<string, unknown>;

    if (farmCount === 1) {
      // Single farm: personalised message
      const farm = userFarms[0];
      title = `${farm.name} — Weekly Summary`;
      const parts: string[] = [];
      if (alertCount > 0) {
        parts.push(`${alertCount} weather alert${alertCount !== 1 ? "s" : ""} this week`);
      }
      if (noteCount > 0) {
        parts.push(`${noteCount} critical scouting note${noteCount !== 1 ? "s" : ""}`);
      }
      if (parts.length === 0) {
        parts.push("No critical alerts this week — conditions look good!");
      }
      body = parts.join(" · ") + " Tap to review.";
      data = { screen: "farm", farmProfileId: farm.id };
    } else {
      // Multi-farm: summary message
      title = "Bloomy Weekly Farm Digest";
      const parts: string[] = [`${farmCount} farms`];
      if (alertCount > 0) {
        parts.push(`${alertCount} alert${alertCount !== 1 ? "s" : ""}`);
      }
      if (noteCount > 0) {
        parts.push(`${noteCount} scouting issue${noteCount !== 1 ? "s" : ""}`);
      }
      if (alertCount === 0 && noteCount === 0) {
        parts.push("all clear this week");
      }
      body = parts.join(" · ") + ". Tap to review your fields.";
      data = { screen: "agriculture" };
    }

    // Queue one message per valid token
    for (const token of tokens) {
      if (!Expo.isExpoPushToken(token)) {
        logger.warn({ token }, "Weekly digest: skipping invalid push token");
        badTokens.push(token);
        continue;
      }
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data,
        badge: alertCount + noteCount,
        channelId: "weekly-digest",
      });
    }
  }

  if (messages.length === 0) {
    logger.info("Weekly digest: no valid messages to send");
    return;
  }

  // 6. Send in chunks (Expo limit: 100 per request)
  const chunks = expo.chunkPushNotifications(messages);
  let successCount = 0;
  let failCount = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "ok") {
          successCount++;
        } else {
          failCount++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            // Token is stale — we could clean it up here but it's non-critical
            logger.warn({ ticket }, "Weekly digest: device not registered");
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Weekly digest: error sending chunk");
    }
  }

  logger.info(
    { successCount, failCount, badTokens: badTokens.length },
    "Weekly digest: run complete"
  );
}

// ── Cron schedule ─────────────────────────────────────────────────────────────

/**
 * Start the weekly digest cron job.
 * Runs every Sunday at 19:00 UTC (comfortable early-evening window for US timezones).
 * Call once from index.ts after the server starts listening.
 */
export function startWeeklyDigestCron(): void {
  // "0 19 * * 0" = 7 PM UTC every Sunday
  cron.schedule("0 19 * * 0", () => {
    sendWeeklyDigests().catch((err) => {
      logger.error({ err }, "Weekly digest: unhandled error");
    });
  });

  logger.info("Weekly digest: cron scheduled (Sundays 19:00 UTC)");
}
