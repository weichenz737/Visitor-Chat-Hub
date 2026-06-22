import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable(
  "chat_sessions",
  {
    id: serial("id").primaryKey(),
    visitorId: text("visitor_id"),
    visitorNickname: text("visitor_nickname").notNull(),
    status: text("status").notNull().default("waiting"), // waiting | active | closed
    agentId: integer("agent_id"), // also serves as owner_id for data isolation
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    agentLastReadMsgId: integer("agent_last_read_msg_id").notNull().default(0),
    visitorLastReadMsgId: integer("visitor_last_read_msg_id").notNull().default(0),
    lastMessageId: integer("last_message_id").notNull().default(0),
  },
  (table) => [index("sessions_agent_id_idx").on(table.agentId)]
);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
