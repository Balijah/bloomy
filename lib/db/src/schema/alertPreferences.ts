import { pgTable, text, serial, timestamp, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const alertPreferencesTable = pgTable("alert_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  alertTypes: text("alert_types").array().notNull().default([
    "frost", "hard_freeze", "extreme_heat", "heavy_precipitation",
    "flash_flood", "drought", "high_wind", "hail", "harvest_disruption",
    "late_season_frost", "winter_storm"
  ]),
  frostThreshold: doublePrecision("frost_threshold").notNull().default(32),
  heatThreshold: doublePrecision("heat_threshold").notNull().default(95),
  precipThreshold: doublePrecision("precip_threshold").notNull().default(2),
  windThreshold: doublePrecision("wind_threshold").notNull().default(35),
  weeklyDigestEnabled: boolean("weekly_digest_enabled").notNull().default(true),
  digestMinSeverity: text("digest_min_severity").notNull().default("high"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAlertPreferencesSchema = createInsertSchema(alertPreferencesTable).omit({ id: true, updatedAt: true });
export type InsertAlertPreferences = z.infer<typeof insertAlertPreferencesSchema>;
export type AlertPreferences = typeof alertPreferencesTable.$inferSelect;
