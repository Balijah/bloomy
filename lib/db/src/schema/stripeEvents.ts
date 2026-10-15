import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const stripeEventsTable = pgTable("stripe_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StripeEvent = typeof stripeEventsTable.$inferSelect;
