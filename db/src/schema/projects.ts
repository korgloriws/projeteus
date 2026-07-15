import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const projectStatusValues = [
  "planejamento",
  "em_andamento",
  "pausado",
  "concluido",
  "cancelado",
] as const;

export const projectPriorityValues = [
  "baixa",
  "media",
  "alta",
  "urgente",
] as const;

export const projectsTable = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: projectStatusValues })
    .notNull()
    .default("planejamento"),
  priority: text("priority", { enum: projectPriorityValues })
    .notNull()
    .default("media"),
  empresaOrgId: integer("empresa_org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  entePublicoOrgId: integer("ente_publico_org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id").references(
    () => usersTable.id,
    { onDelete: "set null" },
  ),
  dueDate: text("due_date"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
