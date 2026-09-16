import { eq, inArray } from "drizzle-orm";
import { db, taskAssigneesTable, tasksTable } from "@db";

export async function getTaskAssigneeIds(taskId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: taskAssigneesTable.userId })
    .from(taskAssigneesTable)
    .where(eq(taskAssigneesTable.taskId, taskId));

  if (rows.length > 0) {
    return rows.map((row) => row.userId);
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));

  return task?.assigneeUserId ? [task.assigneeUserId] : [];
}

export async function loadTaskAssigneeIdsForTasks(
  taskIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (taskIds.length === 0) return map;

  const rows = await db
    .select()
    .from(taskAssigneesTable)
    .where(inArray(taskAssigneesTable.taskId, taskIds));

  for (const row of rows) {
    const current = map.get(row.taskId) ?? [];
    current.push(row.userId);
    map.set(row.taskId, current);
  }

  const missingIds = taskIds.filter((id) => !map.has(id));
  if (missingIds.length > 0) {
    const legacyTasks = await db
      .select()
      .from(tasksTable)
      .where(inArray(tasksTable.id, missingIds));

    for (const task of legacyTasks) {
      if (task.assigneeUserId) {
        map.set(task.id, [task.assigneeUserId]);
      } else {
        map.set(task.id, []);
      }
    }
  }

  return map;
}

export async function syncTaskAssignees(
  taskId: number,
  assigneeUserIds: number[],
) {
  const uniqueIds = [...new Set(assigneeUserIds)];

  await db
    .delete(taskAssigneesTable)
    .where(eq(taskAssigneesTable.taskId, taskId));

  if (uniqueIds.length > 0) {
    await db.insert(taskAssigneesTable).values(
      uniqueIds.map((userId) => ({
        taskId,
        userId,
      })),
    );
  }

  await db
    .update(tasksTable)
    .set({ assigneeUserId: uniqueIds[0] ?? null })
    .where(eq(tasksTable.id, taskId));
}

export function serializeTaskWithAssignees<T extends { id: number; assigneeUserId: number | null }>(
  task: T,
  assigneeIds: number[],
) {
  return {
    ...task,
    assigneeUserIds: assigneeIds,
    assigneeUserId: assigneeIds[0] ?? task.assigneeUserId ?? null,
  };
}
