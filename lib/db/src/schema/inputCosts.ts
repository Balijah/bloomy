import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  doublePrecision,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { farmProfilesTable } from "./farmProfiles";

export const INPUT_COST_CATEGORIES = [
  "seed",
  "fertilizer",
  "herbicide",
  "pesticide",
  "fuel",
  "labor",
  "custom_operation",
  "equipment",
  "irrigation",
  "drying",
  "other",
] as const;

export type InputCostCategory = (typeof INPUT_COST_CATEGORIES)[number];

export const inputCostsTable = pgTable("input_costs", {
  id: serial("id").primaryKey(),
  farmProfileId: integer("farm_profile_id")
    .notNull()
    .references(() => farmProfilesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("other"),
  item: text("item").notNull(),
  costPerAcre: doublePrecision("cost_per_acre"),
  totalCost: doublePrecision("total_cost"),
  acresApplied: doublePrecision("acres_applied"),
  date: date("date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertInputCostSchema = createInsertSchema(
  inputCostsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertInputCost = z.infer<typeof insertInputCostSchema>;
export type InputCost = typeof inputCostsTable.$inferSelect;
