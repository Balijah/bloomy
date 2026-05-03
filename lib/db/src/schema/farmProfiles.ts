import { pgTable, text, serial, timestamp, integer, doublePrecision, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { locationsTable } from "./locations";

export const farmProfilesTable = pgTable("farm_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cropType: text("crop_type").notNull(),
  acreage: doublePrecision("acreage"),
  soilType: text("soil_type"),
  plantingDate: date("planting_date"),
  harvestDate: date("harvest_date"),
  yieldGoal: doublePrecision("yield_goal"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFarmProfileSchema = createInsertSchema(farmProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFarmProfile = z.infer<typeof insertFarmProfileSchema>;
export type FarmProfile = typeof farmProfilesTable.$inferSelect;
