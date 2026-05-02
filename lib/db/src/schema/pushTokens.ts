import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("ios"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("push_tokens_user_token_unique").on(t.userId, t.token)]
);

export type PushToken = typeof pushTokensTable.$inferSelect;
