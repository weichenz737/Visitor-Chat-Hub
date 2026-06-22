import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable(
  "system_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id"),
    actorUsername: text("actor_username"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: integer("target_id"),
    detail: text("detail"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("system_logs_created_at_idx").on(table.createdAt),
    index("system_logs_action_idx").on(table.action),
    index("system_logs_actor_id_idx").on(table.actorId),
  ],
);

export type SystemLog = typeof systemLogsTable.$inferSelect;
