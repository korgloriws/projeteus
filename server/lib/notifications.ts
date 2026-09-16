import { and, count, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  notificationsTable,
  projectMembersTable,
  type Notification,
  type NotificationType,
} from "@db";

export interface NotificationPayload {
  actorUserId: number;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: number | null;
  stageId?: number | null;
  taskId?: number | null;
  link?: string | null;
}

export async function getProjectMemberUserIds(
  projectId: number,
): Promise<number[]> {
  const rows = await db
    .select({ userId: projectMembersTable.userId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.projectId, projectId));
  return [...new Set(rows.map((row) => row.userId))];
}

export async function createNotificationsForUsers(
  userIds: number[],
  payload: NotificationPayload,
  { excludeActor = true }: { excludeActor?: boolean } = {},
): Promise<void> {
  const recipients = [...new Set(userIds)].filter(
    (id) => !excludeActor || id !== payload.actorUserId,
  );
  if (recipients.length === 0) return;

  await db.insert(notificationsTable).values(
    recipients.map((userId) => ({
      userId,
      actorUserId: payload.actorUserId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      projectId: payload.projectId ?? null,
      stageId: payload.stageId ?? null,
      taskId: payload.taskId ?? null,
      link: payload.link ?? null,
    })),
  );
}

export async function notifyProjectMembers(
  payload: NotificationPayload & { projectId: number },
  { excludeUserIds = [] }: { excludeUserIds?: number[] } = {},
): Promise<void> {
  const memberIds = await getProjectMemberUserIds(payload.projectId);
  const exclude = new Set(excludeUserIds);
  const recipients = memberIds.filter((id) => !exclude.has(id));
  await createNotificationsForUsers(recipients, payload);
}

/**
 * Runs a notification side effect without ever throwing, so that a failure in
 * the notification pipeline never breaks the primary request/response.
 */
export async function runNotify(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (error) {
    console.error("[notifications] failed to create notification", error);
  }
}

function serialize(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    projectId: notification.projectId,
    stageId: notification.stageId,
    taskId: notification.taskId,
    link: notification.link,
    actorUserId: notification.actorUserId,
    isRead: notification.readAt !== null,
    createdAt: notification.createdAt,
  };
}

export type SerializedNotification = ReturnType<typeof serialize>;

export async function listUserNotifications(
  userId: number,
  { limit = 30, unreadOnly = false }: { limit?: number; unreadOnly?: boolean } = {},
): Promise<SerializedNotification[]> {
  const condition = unreadOnly
    ? and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      )
    : eq(notificationsTable.userId, userId);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(condition)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);

  return rows.map(serialize);
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
  return row?.value ?? 0;
}

export async function markNotificationRead(
  userId: number,
  notificationId: number,
): Promise<boolean> {
  const updated = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId),
      ),
    )
    .returning({ id: notificationsTable.id });
  return updated.length > 0;
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
}
