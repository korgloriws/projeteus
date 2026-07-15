import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable, projectStatusValues } from "./projects";

export const stagesTable = sqliteTable("stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  status: text("status", { enum: projectStatusValues })
    .notNull()
    .default("planejamento"),
  dueDate: text("due_date"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertStageSchema = createInsertSchema(stagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStage = z.infer<typeof insertStageSchema>;
export type Stage = typeof stagesTable.$inferSelect;
