import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";
import { agentsTable } from "./agents";

export const sessionTransfersTable = pgTable(
  "session_transfers",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    fromAgentId: integer("from_agent_id")
      .notNull()
      .references(() => agentsTable.id),
    toAgentId: integer("to_agent_id")
      .notNull()
      .references(() => agentsTable.id),
    initiatedBy: integer("initiated_by")
      .notNull()
      .references(() => agentsTable.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("session_transfers_session_id_idx").on(table.sessionId),
    index("session_transfers_from_agent_id_idx").on(table.fromAgentId),
    index("session_transfers_to_agent_id_idx").on(table.toAgentId),
    index("session_transfers_created_at_idx").on(table.createdAt),
  ],
);

export const insertSessionTransferSchema = createInsertSchema(sessionTransfersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSessionTransfer = z.infer<typeof insertSessionTransferSchema>;
export type SessionTransfer = typeof sessionTransfersTable.$inferSelect;
