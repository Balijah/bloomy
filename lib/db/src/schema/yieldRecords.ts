import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { farmProfilesTable } from "./farmProfiles";

export const yieldRecordsTable = pgTable("yield_records", {
  id: serial("id").primaryKey(),
  farmProfileId: integer("farm_profile_id")
    .notNull()
    .references(() => farmProfilesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  harvestYear: integer("harvest_year").notNull(),
  actualYield: doublePrecision("actual_yield").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertYieldRecordSchema = createInsertSchema(
  yieldRecordsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertYieldRecord = z.infer<typeof insertYieldRecordSchema>;
export type YieldRecord = typeof yieldRecordsTable.$inferSelect;
