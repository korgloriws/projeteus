import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { stagesTable } from "./stages";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";

export const attachmentsTable = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  stageId: integer("stage_id").references(() => stagesTable.id, {
    onDelete: "cascade",
  }),
  taskId: integer("task_id").references(() => tasksTable.id, {
    onDelete: "cascade",
  }),
  uploadedByUserId: integer("uploaded_by_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertAttachmentSchema = createInsertSchema(attachmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachmentsTable.$inferSelect;
