import { pgTable, text, serial, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";
import { agentsTable } from "./agents";

export const sessionNotesTable = pgTable(
  "session_notes",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agentsTable.id),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("session_notes_session_agent_idx").on(table.sessionId, table.agentId),
    index("session_notes_session_id_idx").on(table.sessionId),
  ],
);

export const insertSessionNoteSchema = createInsertSchema(sessionNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSessionNote = z.infer<typeof insertSessionNoteSchema>;
export type SessionNote = typeof sessionNotesTable.$inferSelect;
