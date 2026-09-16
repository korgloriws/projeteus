import { integer, sqliteTable, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stagesTable } from "./stages";
import { usersTable } from "./users";

export const stageMembersTable = sqliteTable(
  "stage_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stageId: integer("stage_id")
      .notNull()
      .references(() => stagesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("stage_members_stage_user_unique").on(
      table.stageId,
      table.userId,
    ),
  ],
);

export const insertStageMemberSchema = createInsertSchema(
  stageMembersTable,
).omit({ id: true, createdAt: true });
export type InsertStageMember = z.infer<typeof insertStageMemberSchema>;
export type StageMember = typeof stageMembersTable.$inferSelect;
