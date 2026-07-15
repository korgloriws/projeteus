import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";

export const taskAssigneesTable = sqliteTable(
  "task_assignees",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })],
);
