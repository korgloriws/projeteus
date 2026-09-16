import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  projectMembersTable,
  projectsTable,
  stagesTable,
  stageMembersTable,
  tasksTable,
  type User,
} from "@db";
import { loadTaskAssigneeIdsForTasks } from "./task-assignees";

export type MyTaskStatus =
  | "a_fazer"
  | "em_andamento"
  | "em_revisao"
  | "concluida";

export type MyTaskItem = {
  id: number;
  stageId: number;
  projectId: number;
  title: string;
  description: string | null;
  status: MyTaskStatus;
  priority: string;
  assigneeUserId: number | null;
  dueDate: string | null;
  order: number;
  createdAt: Date;
  projectTitle: string;
  stageTitle: string;
};

export type MyTasksFilters = {
  status?: MyTaskStatus;
  projectId?: number;
  stageId?: number;
  dueFrom?: string;
  dueTo?: string;
};

async function getUserTaskContext(user: User) {
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

  let accessibleProjectIds: number[];
  if (user.role === "admin") {
    const projects = await db.select({ id: projectsTable.id }).from(projectsTable);
    accessibleProjectIds = projects.map((project) => project.id);
  } else {
    accessibleProjectIds = Array.from(memberProjectIds);
  }

  const stageMemberRows =
    accessibleProjectIds.length === 0
      ? []
      : await db
          .select({ stageId: stageMembersTable.stageId })
          .from(stageMembersTable)
          .innerJoin(stagesTable, eq(stageMembersTable.stageId, stagesTable.id))
          .where(
            and(
              eq(stageMembersTable.userId, user.id),
              inArray(stagesTable.projectId, accessibleProjectIds),
            ),
          );

  return {
    accessibleProjectIds,
    gestorProjectIds,
    stageMemberStageIds: new Set(stageMemberRows.map((row) => row.stageId)),
  };
}

function isTaskVisibleToUser(
  user: User,
  task: typeof tasksTable.$inferSelect,
  gestorProjectIds: Set<number>,
  stageMemberStageIds: Set<number>,
  assigneeUserIds: number[],
): boolean {
  if (user.role === "admin") return true;
  if (assigneeUserIds.includes(user.id)) return true;
  if (task.assigneeUserId === user.id) return true;
  if (gestorProjectIds.has(task.projectId)) return true;
  if (stageMemberStageIds.has(task.stageId)) return true;
  return false;
}

function matchesFilters(
  task: MyTaskItem,
  filters: MyTasksFilters,
): boolean {
  if (filters.status && task.status !== filters.status) return false;
  if (filters.projectId !== undefined && task.projectId !== filters.projectId) {
    return false;
  }
  if (filters.stageId !== undefined && task.stageId !== filters.stageId) {
    return false;
  }
  if (filters.dueFrom && task.dueDate && task.dueDate < filters.dueFrom) {
    return false;
  }
  if (filters.dueFrom && !task.dueDate) return false;
  if (filters.dueTo && task.dueDate && task.dueDate > filters.dueTo) {
    return false;
  }
  if (filters.dueTo && !task.dueDate) return false;
  return true;
}

export async function buildMyTasks(
  user: User,
  filters: MyTasksFilters = {},
): Promise<MyTaskItem[]> {
  const { accessibleProjectIds, gestorProjectIds, stageMemberStageIds } =
    await getUserTaskContext(user);

  if (accessibleProjectIds.length === 0) return [];

  const [tasks, projects, stages] = await Promise.all([
    db
      .select()
      .from(tasksTable)
      .where(inArray(tasksTable.projectId, accessibleProjectIds))
      .orderBy(asc(tasksTable.dueDate), asc(tasksTable.createdAt)),
    db
      .select()
      .from(projectsTable)
      .where(inArray(projectsTable.id, accessibleProjectIds)),
    db
      .select()
      .from(stagesTable)
      .where(inArray(stagesTable.projectId, accessibleProjectIds)),
  ]);

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]));
  const stageTitleById = new Map(stages.map((s) => [s.id, s.name]));
  const assigneeMap = await loadTaskAssigneeIdsForTasks(tasks.map((task) => task.id));

  return tasks
    .filter((task) =>
      isTaskVisibleToUser(
        user,
        task,
        gestorProjectIds,
        stageMemberStageIds,
        assigneeMap.get(task.id) ?? [],
      ),
    )
    .map((task) => ({
      id: task.id,
      stageId: task.stageId,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status as MyTaskStatus,
      priority: task.priority,
      assigneeUserId: task.assigneeUserId,
      dueDate: task.dueDate,
      order: task.order,
      createdAt: task.createdAt,
      projectTitle: projectTitleById.get(task.projectId) ?? "",
      stageTitle: stageTitleById.get(task.stageId) ?? "",
    }))
    .filter((task) => matchesFilters(task, filters));
}

export async function getMyTasksFilterOptions(user: User) {
  const tasks = await buildMyTasks(user);
  const projectIds = new Set(tasks.map((task) => task.projectId));
  const stageIds = new Set(tasks.map((task) => task.stageId));

  const projects = await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.id, Array.from(projectIds)));

  const stages = await db
    .select()
    .from(stagesTable)
    .where(inArray(stagesTable.id, Array.from(stageIds)));

  return {
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
    })),
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      projectId: stage.projectId,
    })),
    statuses: ["a_fazer", "em_andamento", "em_revisao", "concluida"] as const,
  };
}
