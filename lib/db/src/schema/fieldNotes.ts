import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { farmProfilesTable } from "./farmProfiles";

export const NOTE_CATEGORIES = [
  "pest",
  "disease",
  "soil",
  "weather",
  "irrigation",
  "general",
] as const;

export const NOTE_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const fieldNotesTable = pgTable("field_notes", {
  id: serial("id").primaryKey(),
  farmProfileId: integer("farm_profile_id")
    .notNull()
    .references(() => farmProfilesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  category: text("category").notNull().default("general"),
  severity: text("severity"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  photoData: text("photo_data").array(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFieldNoteSchema = createInsertSchema(
  fieldNotesTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFieldNote = z.infer<typeof insertFieldNoteSchema>;
export type FieldNote = typeof fieldNotesTable.$inferSelect;
