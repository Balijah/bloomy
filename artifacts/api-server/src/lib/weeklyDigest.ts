/**
 * Weekly farm digest — sent every Sunday at 7 PM UTC.
 *
 * Delivers two channels per opted-in user:
 *   1. Expo push notification (if device push token is registered)
 *   2. SendGrid email (if SENDGRID env vars are configured)
 *
 * Data comes entirely from existing DB rows — no live weather API calls are
 * made during the cron run, so it completes quickly even with many users.
 *
 * Per-user preferences (alert_preferences.weekly_digest_enabled and
 * digest_min_severity) are respected before any message is sent.
 */

import cron from "node-cron";
import Expo, { type ExpoPushMessage } from "expo-server-sdk";
import {
  db,
  usersTable,
  farmProfilesTable,
  pushTokensTable,
  alertsTable,
  fieldNotesTable,
  alertPreferencesTable,
} from "@workspace/db";
import { eq, and, gte, inArray, or } from "drizzle-orm";
import { logger } from "./logger";
import { sendDigestEmail, type FarmDigestRow } from "./digestEmail";

const expo = new Expo();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function isoDateOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDigestDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Core digest logic ─────────────────────────────────────────────────────────

async function sendWeeklyDigests(): Promise<void> {
  logger.info("Weekly digest: starting run");

  // 1. Get all users who have at least one farm profile
  const usersWithFarms = await db
    .selectDistinct({
      userId: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .innerJoin(farmProfilesTable, eq(farmProfilesTable.userId, usersTable.id));

  if (usersWithFarms.length === 0) {
    logger.info("Weekly digest: no users with farms — skipping");
    return;
  }

  const allUserIds = usersWithFarms.map((u) => u.userId);

  // Build email lookup map
  const userInfoMap = new Map<
    number,
    { email: string; firstName: string | null; lastName: string | null }
  >();
  for (const u of usersWithFarms) {
    userInfoMap.set(u.userId, {
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
    });
  }

  // 2. Load preferences and filter to opted-in users
  const prefRows = await db
    .select({
      userId: alertPreferencesTable.userId,
      weeklyDigestEnabled: alertPreferencesTable.weeklyDigestEnabled,
      digestMinSeverity: alertPreferencesTable.digestMinSeverity,
    })
    .from(alertPreferencesTable)
    .where(inArray(alertPreferencesTable.userId, allUserIds));

  const prefsByUser = new Map<
    number,
    { weeklyDigestEnabled: boolean; digestMinSeverity: string }
  >();
  for (const pref of prefRows) {
    prefsByUser.set(pref.userId, {
      weeklyDigestEnabled: pref.weeklyDigestEnabled,
      digestMinSeverity: pref.digestMinSeverity,
    });
  }

  // Default: opted-in if no prefs row exists yet
  const userIds = allUserIds.filter((uid) => {
    const pref = prefsByUser.get(uid);
    return pref === undefined ? true : pref.weeklyDigestEnabled;
  });

  if (userIds.length === 0) {
    logger.info("Weekly digest: all users have opted out — skipping");
    return;
  }

  // 3. Fetch farms for opted-in users
  const farms = await db
    .select()
    .from(farmProfilesTable)
    .where(inArray(farmProfilesTable.userId, userIds));

  const farmsByUser = new Map<number, typeof farms>();
  for (const farm of farms) {
    const arr = farmsByUser.get(farm.userId) ?? [];
    arr.push(farm);
    farmsByUser.set(farm.userId, arr);
  }

  // 4. Load push tokens for opted-in users
  const tokenRows = await db
    .select({ userId: pushTokensTable.userId, token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));

  const userTokenMap = new Map<number, string[]>();
  for (const row of tokenRows) {
    const existing = userTokenMap.get(row.userId) ?? [];
    existing.push(row.token);
    userTokenMap.set(row.userId, existing);
  }

  // 5. Fetch all recent critical/warning alerts for opted-in users (last 7 days)
  const recentAlerts = await db
    .select({
      userId: alertsTable.userId,
      farmProfileId: alertsTable.farmProfileId,
      severity: alertsTable.severity,
    })
    .from(alertsTable)
    .where(
      and(
        inArray(alertsTable.userId, userIds),
        gte(alertsTable.triggeredAt, sevenDaysAgo()),
        or(eq(alertsTable.severity, "critical"), eq(alertsTable.severity, "warning"))
      )
    );

  const alertsByUserFarm = new Map<string, typeof recentAlerts>();
  for (const alert of recentAlerts) {
    const key = `${alert.userId}:${alert.farmProfileId ?? "none"}`;
    const arr = alertsByUserFarm.get(key) ?? [];
    arr.push(alert);
    alertsByUserFarm.set(key, arr);
  }

  // All alerts grouped by userId (for push notification total count)
  const alertsByUser = new Map<number, typeof recentAlerts>();
  for (const alert of recentAlerts) {
    const arr = alertsByUser.get(alert.userId) ?? [];
    arr.push(alert);
    alertsByUser.set(alert.userId, arr);
  }

  // 6. Fetch critical/high field notes from last 30 days
  const thirtyAgoIso = isoDateOf(thirtyDaysAgo());
  const criticalNotes = await db
    .select({
      userId: fieldNotesTable.userId,
      farmProfileId: fieldNotesTable.farmProfileId,
      severity: fieldNotesTable.severity,
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

  const notesByUserFarm = new Map<string, typeof criticalNotes>();
  for (const note of criticalNotes) {
    const key = `${note.userId}:${note.farmProfileId}`;
    const arr = notesByUserFarm.get(key) ?? [];
    arr.push(note);
    notesByUserFarm.set(key, arr);
  }

  const notesByUser = new Map<number, typeof criticalNotes>();
  for (const note of criticalNotes) {
    const arr = notesByUser.get(note.userId) ?? [];
    arr.push(note);
    notesByUser.set(note.userId, arr);
  }

  // 7. Build digest per user and dispatch push + email
  const pushMessages: ExpoPushMessage[] = [];
  const badTokens: string[] = [];
  let emailSent = 0;
  let emailFailed = 0;

  const digestDate = formatDigestDate();

  for (const userId of userIds) {
    const userFarms = farmsByUser.get(userId) ?? [];
    if (userFarms.length === 0) continue;

    const minSeverity = prefsByUser.get(userId)?.digestMinSeverity ?? "high";

    // Build per-farm rows for email, applying severity filter
    const farmRows: FarmDigestRow[] = userFarms.map((farm) => {
      const farmKey = `${userId}:${farm.id}`;

      const rawAlerts = alertsByUserFarm.get(farmKey) ?? [];
      const filteredAlerts = rawAlerts.filter((a) => {
        if (minSeverity === "critical") return a.severity === "critical";
        if (minSeverity === "high") return a.severity === "critical" || a.severity === "warning";
        return true;
      });

      const rawNotes = notesByUserFarm.get(farmKey) ?? [];
      const filteredNotes = rawNotes.filter((n) => {
        if (minSeverity === "critical") return n.severity === "critical";
        if (minSeverity === "high") return n.severity === "critical" || n.severity === "high";
        return true;
      });

      return {
        name: farm.name,
        cropType: farm.cropType,
        alertCount: filteredAlerts.length,
        noteCount: filteredNotes.length,
      };
    });

    const totalAlerts = farmRows.reduce((sum, f) => sum + f.alertCount, 0);
    const totalNotes = farmRows.reduce((sum, f) => sum + f.noteCount, 0);

    // ── Email ────────────────────────────────────────────────────────────────
    const info = userInfoMap.get(userId);
    if (info) {
      const firstName = info.firstName;
      try {
        await sendDigestEmail({
          toEmail: info.email,
          toName: firstName,
          farms: farmRows,
          totalAlerts,
          totalNotes,
          digestDate,
        });
        emailSent++;
      } catch {
        emailFailed++;
      }
    }

    // ── Push notification ────────────────────────────────────────────────────
    const tokens = userTokenMap.get(userId) ?? [];
    if (tokens.length === 0) continue;

    const farmCount = userFarms.length;
    let title: string;
    let body: string;
    let data: Record<string, unknown>;

    if (farmCount === 1) {
      const farm = userFarms[0];
      title = `${farm.name} — Weekly Summary`;
      const parts: string[] = [];
      if (totalAlerts > 0) parts.push(`${totalAlerts} weather alert${totalAlerts !== 1 ? "s" : ""} this week`);
      if (totalNotes > 0) parts.push(`${totalNotes} scouting note${totalNotes !== 1 ? "s" : ""}`);
      if (parts.length === 0) parts.push("No critical alerts — conditions look good!");
      body = parts.join(" · ") + " Tap to review.";
      data = { screen: "farm", farmProfileId: farm.id };
    } else {
      title = "Bloomy Weekly Farm Digest";
      const parts: string[] = [`${farmCount} farms`];
      if (totalAlerts > 0) parts.push(`${totalAlerts} alert${totalAlerts !== 1 ? "s" : ""}`);
      if (totalNotes > 0) parts.push(`${totalNotes} issue${totalNotes !== 1 ? "s" : ""}`);
      if (totalAlerts === 0 && totalNotes === 0) parts.push("all clear this week");
      body = parts.join(" · ") + ". Tap to review your fields.";
      data = { screen: "agriculture" };
    }

    for (const token of tokens) {
      if (!Expo.isExpoPushToken(token)) {
        logger.warn({ token }, "Weekly digest: invalid push token");
        badTokens.push(token);
        continue;
      }
      pushMessages.push({
        to: token,
        sound: "default",
        title,
        body,
        data,
        badge: totalAlerts + totalNotes,
        channelId: "weekly-digest",
      });
    }
  }

  // 8. Send push in chunks (Expo limit: 100 per request)
  let pushSuccess = 0;
  let pushFail = 0;

  if (pushMessages.length > 0) {
    const chunks = expo.chunkPushNotifications(pushMessages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === "ok") {
            pushSuccess++;
          } else {
            pushFail++;
            if (ticket.details?.error === "DeviceNotRegistered") {
              logger.warn({ ticket }, "Weekly digest: device not registered");
            }
          }
        }
      } catch (err) {
        logger.error({ err }, "Weekly digest: push chunk error");
      }
    }
  }

  logger.info(
    {
      usersProcessed: userIds.length,
      emailSent,
      emailFailed,
      pushSuccess,
      pushFail,
      badTokens: badTokens.length,
    },
    "Weekly digest: run complete"
  );
}

// ── Cron schedule ─────────────────────────────────────────────────────────────

/**
 * Start the weekly digest cron job.
 * Runs every Sunday at 19:00 UTC (early evening for US timezones).
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
