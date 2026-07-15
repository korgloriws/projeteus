import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stagesTable } from "./stages";
import { projectsTable, projectPriorityValues } from "./projects";
import { usersTable } from "./users";

export const taskStatusValues = [
  "a_fazer",
  "em_andamento",
  "em_revisao",
  "concluida",
] as const;

export const tasksTable = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stageId: integer("stage_id")
    .notNull()
    .references(() => stagesTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: taskStatusValues })
    .notNull()
    .default("a_fazer"),
  priority: text("priority", { enum: projectPriorityValues })
    .notNull()
    .default("media"),
  assigneeUserId: integer("assignee_user_id").references(
    () => usersTable.id,
    { onDelete: "set null" },
  ),
  dueDate: text("due_date"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
