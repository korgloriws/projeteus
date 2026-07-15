import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { stagesTable } from "./stages";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";

export const notificationTypeValues = [
  "task_created",
  "task_assigned",
  "task_updated",
  "task_completed",
  "task_moved",
  "task_deleted",
  "stage_created",
  "stage_assigned",
  "stage_updated",
  "stage_completed",
  "stage_deleted",
  "comment_created",
  "project_updated",
  "project_gestor_assigned",
  "member_added",
] as const;

export type NotificationType = (typeof notificationTypeValues)[number];

export const notificationsTable = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: notificationTypeValues }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    projectId: integer("project_id").references(() => projectsTable.id, {
      onDelete: "cascade",
    }),
    stageId: integer("stage_id").references(() => stagesTable.id, {
      onDelete: "cascade",
    }),
    taskId: integer("task_id").references(() => tasksTable.id, {
      onDelete: "cascade",
    }),
    link: text("link"),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
