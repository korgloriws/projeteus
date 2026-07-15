import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const projectMemberRoleValues = ["gestor", "membro"] as const;

export const projectMembersTable = sqliteTable(
  "project_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: projectMemberRoleValues })
      .notNull()
      .default("membro"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("project_members_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
  ],
);

export const insertProjectMemberSchema = createInsertSchema(
  projectMembersTable,
).omit({ id: true, createdAt: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembersTable.$inferSelect;
