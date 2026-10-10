import { pgTable, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const atlasWorkspaces = pgTable("atlas_workspaces", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  data: jsonb("data").notNull(),
  encryptedKey: text("encrypted_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: text("user_id"),
  migratedTo: text("migrated_to"),
}, (table) => [
  uniqueIndex("atlas_workspaces_user_id_unique").on(table.userId),
  uniqueIndex("atlas_workspaces_clerk_user_id_unique").on(table.clerkUserId),
]);
export const insertAtlasWorkspaceSchema = createInsertSchema(atlasWorkspaces);
export type AtlasWorkspace = typeof atlasWorkspaces.$inferSelect;
