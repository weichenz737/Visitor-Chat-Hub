import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";

export const quickRepliesTable = pgTable("quick_replies", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuickReplySchema = createInsertSchema(quickRepliesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuickReply = z.infer<typeof insertQuickReplySchema>;
export type QuickReply = typeof quickRepliesTable.$inferSelect;
