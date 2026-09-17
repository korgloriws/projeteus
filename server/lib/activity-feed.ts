import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  projectMembersTable,
  projectsTable,
  stagesTable,
  stageMembersTable,
  tasksTable,
  commentsTable,
  usersTable,
  type User,
} from "@db";
import { loadTaskAssigneeIdsForTasks } from "./task-assignees";

export type ActivityType =
  | "project_created"
  | "project_updated"
  | "stage_created"
  | "stage_updated"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "comment_created";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  projectId: number;
  projectTitle: string;
  stageId: number | null;
  stageTitle: string | null;
  taskId: number | null;
  taskTitle: string | null;
  actorUserId: number;
  assigneeUserId: number | null;
  assigneeUserIds: number[];
  summary: string;
  createdAt: Date;
};

export type ActivityFeedFilters = {
  fromDate?: string;
  toDate?: string;
  projectId?: number;
  assigneeUserId?: number;
  taskId?: number;
  stageId?: number;
  limit?: number;
};

async function getUserProjectContext(user: User) {
  const allProjects = await db.select().from(projectsTable);
  const memberships = await db
    .select()
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const memberProjectIds = new Set(memberships.map((row) => row.projectId));
  const gestorProjectIds = new Set(
    memberships
      .filter((row) => row.role === "gestor")
      .map((row) => row.projectId),
  );

  const accessibleProjects =
    user.role === "admin"
      ? allProjects
      : allProjects.filter((project) => memberProjectIds.has(project.id));

  return {
    accessibleProjects,
    memberProjectIds,
    gestorProjectIds,
    accessibleProjectIds: accessibleProjects.map((project) => project.id),
  };
}

function isWithinPeriod(date: Date, fromDate?: string, toDate?: string): boolean {
  const time = date.getTime();
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    if (time < from) return false;
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    if (time > to) return false;
  }
  return true;
}

function matchesFilters(
  item: ActivityItem,
  filters: ActivityFeedFilters,
): boolean {
  if (filters.projectId !== undefined && item.projectId !== filters.projectId) {
    return false;
  }
  if (filters.assigneeUserId !== undefined) {
    const ids =
      item.assigneeUserIds.length > 0
        ? item.assigneeUserIds
        : item.assigneeUserId != null
          ? [item.assigneeUserId]
          : [];
    if (!ids.includes(filters.assigneeUserId)) return false;
  }
  if (filters.taskId !== undefined && item.taskId !== filters.taskId) {
    return false;
  }
  if (filters.stageId !== undefined && item.stageId !== filters.stageId) {
    return false;
  }
  if (!isWithinPeriod(item.createdAt, filters.fromDate, filters.toDate)) {
    return false;
  }
  return true;
}

function isVisibleToUser(
  item: ActivityItem,
  user: User,
  gestorProjectIds: Set<number>,
  stageMemberIds: Set<number>,
): boolean {
  if (user.role === "admin") return true;
  if (gestorProjectIds.has(item.projectId)) return true;

  if (item.actorUserId === user.id) return true;
  if (item.assigneeUserId === user.id) return true;
  if (item.assigneeUserIds.includes(user.id)) return true;
  if (item.type === "comment_created" && item.actorUserId === user.id) {
    return true;
  }
  if (item.stageId !== null && stageMemberIds.has(item.stageId)) return true;

  return false;
}

export async function buildUserActivityFeed(
  user: User,
  filters: ActivityFeedFilters = {},
): Promise<ActivityItem[]> {
  const { accessibleProjects, gestorProjectIds, accessibleProjectIds } =
    await getUserProjectContext(user);

  if (accessibleProjectIds.length === 0) return [];

  const projectTitleById = new Map(
    accessibleProjects.map((project) => [project.id, project.title]),
  );

  const [stages, tasks, comments, stageMemberRows] = await Promise.all([
    db
      .select()
      .from(stagesTable)
      .where(inArray(stagesTable.projectId, accessibleProjectIds)),
    db
      .select()
      .from(tasksTable)
      .where(inArray(tasksTable.projectId, accessibleProjectIds)),
    db
      .select()
      .from(commentsTable)
      .where(inArray(commentsTable.projectId, accessibleProjectIds)),
    db
      .select({
        stageId: stageMembersTable.stageId,
        userId: stageMembersTable.userId,
      })
      .from(stageMembersTable)
      .innerJoin(stagesTable, eq(stageMembersTable.stageId, stagesTable.id))
      .where(
        and(
          eq(stageMembersTable.userId, user.id),
          inArray(stagesTable.projectId, accessibleProjectIds),
        ),
      ),
  ]);

  const stageTitleById = new Map(stages.map((stage) => [stage.id, stage.name]));
  const stageMemberIds = new Set(stageMemberRows.map((row) => row.stageId));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskAssigneeMap = await loadTaskAssigneeIdsForTasks(
    tasks.map((task) => task.id),
  );

  const items: ActivityItem[] = [];

  for (const project of accessibleProjects) {
    items.push({
      id: `project-${project.id}`,
      type: "project_created",
      projectId: project.id,
      projectTitle: project.title,
      stageId: null,
      stageTitle: null,
      taskId: null,
      taskTitle: null,
      actorUserId: project.createdByUserId ?? 0,
      assigneeUserId: null,
      assigneeUserIds: [],
      summary: `Projeto "${project.title}" foi criado`,
      createdAt: project.createdAt,
    });
  }

  for (const stage of stages) {
    items.push({
      id: `stage-${stage.id}`,
      type: "stage_created",
      projectId: stage.projectId,
      projectTitle: projectTitleById.get(stage.projectId) ?? "",
      stageId: stage.id,
      stageTitle: stage.name,
      taskId: null,
      taskTitle: null,
      actorUserId: 0,
      assigneeUserId: null,
      assigneeUserIds: [],
      summary: `Etapa "${stage.name}" foi criada`,
      createdAt: stage.createdAt,
    });
  }

  for (const task of tasks) {
    const stageTitle = stageTitleById.get(task.stageId) ?? null;
    const isCompleted = task.status === "concluida";
    const assigneeUserIds = taskAssigneeMap.get(task.id) ?? [];

    items.push({
      id: `task-${task.id}-${isCompleted ? "completed" : "created"}`,
      type: isCompleted ? "task_completed" : "task_created",
      projectId: task.projectId,
      projectTitle: projectTitleById.get(task.projectId) ?? "",
      stageId: task.stageId,
      stageTitle,
      taskId: task.id,
      taskTitle: task.title,
      actorUserId: assigneeUserIds[0] ?? task.assigneeUserId ?? 0,
      assigneeUserId: assigneeUserIds[0] ?? task.assigneeUserId ?? null,
      assigneeUserIds,
      summary: isCompleted
        ? `Tarefa "${task.title}" foi concluída`
        : `Tarefa "${task.title}" foi criada`,
      createdAt: task.createdAt,
    });
  }

  for (const comment of comments) {
    if (!comment.projectId) continue;
    const relatedTask = comment.taskId ? taskById.get(comment.taskId) : null;
    const relatedAssignees = relatedTask
      ? (taskAssigneeMap.get(relatedTask.id) ?? [])
      : [];

    items.push({
      id: `comment-${comment.id}`,
      type: "comment_created",
      projectId: comment.projectId,
      projectTitle: projectTitleById.get(comment.projectId) ?? "",
      stageId: relatedTask?.stageId ?? null,
      stageTitle: relatedTask
        ? stageTitleById.get(relatedTask.stageId) ?? null
        : null,
      taskId: comment.taskId ?? null,
      taskTitle: relatedTask?.title ?? null,
      actorUserId: comment.authorUserId,
      assigneeUserId: relatedAssignees[0] ?? relatedTask?.assigneeUserId ?? null,
      assigneeUserIds: relatedAssignees,
      summary: "Novo comentário",
      createdAt: comment.createdAt,
    });
  }

  const limit = filters.limit ?? 20;

  return items
    .filter((item) =>
      isVisibleToUser(item, user, gestorProjectIds, stageMemberIds),
    )
    .filter((item) => matchesFilters(item, filters))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function getActivityFilterOptions(user: User) {
  const { accessibleProjects, accessibleProjectIds } =
    await getUserProjectContext(user);

  if (accessibleProjectIds.length === 0) {
    return { projects: [], stages: [], tasks: [], assignees: [] };
  }

  const [stages, tasks, members] = await Promise.all([
    db
      .select()
      .from(stagesTable)
      .where(inArray(stagesTable.projectId, accessibleProjectIds))
      .orderBy(stagesTable.order),
    db
      .select()
      .from(tasksTable)
      .where(inArray(tasksTable.projectId, accessibleProjectIds))
      .orderBy(tasksTable.title),
    db
      .select({ member: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(inArray(projectMembersTable.projectId, accessibleProjectIds)),
  ]);

  const taskAssigneeMap = await loadTaskAssigneeIdsForTasks(
    tasks.map((task) => task.id),
  );

  const assigneeMap = new Map<number, string>();
  for (const row of members) {
    assigneeMap.set(row.user.id, row.user.name);
  }
  for (const task of tasks) {
    const ids = taskAssigneeMap.get(task.id) ?? [];
    for (const id of ids) {
      if (!assigneeMap.has(id)) {
        assigneeMap.set(id, `Usuário ${id}`);
      }
    }
    if (task.assigneeUserId && !assigneeMap.has(task.assigneeUserId)) {
      assigneeMap.set(task.assigneeUserId, `Usuário ${task.assigneeUserId}`);
    }
  }

  return {
    projects: accessibleProjects.map((project) => ({
      id: project.id,
      title: project.title,
    })),
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      projectId: stage.projectId,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      stageId: task.stageId,
      assigneeUserId: task.assigneeUserId,
      assigneeUserIds: taskAssigneeMap.get(task.id) ?? [],
    })),
    assignees: Array.from(assigneeMap.entries()).map(([id, name]) => ({
      id,
      name,
    })),
  };
}
