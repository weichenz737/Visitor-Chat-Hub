import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    ownerId: integer("owner_id"), // agent ID who owns the session (for data isolation)
    senderType: text("sender_type").notNull(), // visitor | agent
    messageType: text("message_type").notNull().default("text"), // text | image
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("messages_owner_id_idx").on(table.ownerId)]
);

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
