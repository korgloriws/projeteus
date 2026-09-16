import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, projectMembersTable, projectsTable, tasksTable } from "@db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  buildUserActivityFeed,
  getActivityFilterOptions,
} from "../lib/activity-feed";
import { buildMyTasks, getMyTasksFilterOptions } from "../lib/my-tasks";

const router: IRouter = Router();

const myTasksQuerySchema = z.object({
  status: z.enum(["a_fazer", "em_andamento", "em_revisao", "concluida"]).optional(),
  projectId: z.coerce.number().optional(),
  stageId: z.coerce.number().optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  projectId: z.coerce.number().optional(),
  assigneeUserId: z.coerce.number().optional(),
  taskId: z.coerce.number().optional(),
  stageId: z.coerce.number().optional(),
});

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const user = req.appUser!;
  const projects =
    user.role === "admin"
      ? await db.select().from(projectsTable)
      : await db
          .select({
            id: projectsTable.id,
            title: projectsTable.title,
            description: projectsTable.description,
            empresaOrgId: projectsTable.empresaOrgId,
            entePublicoOrgId: projectsTable.entePublicoOrgId,
            status: projectsTable.status,
            priority: projectsTable.priority,
            dueDate: projectsTable.dueDate,
            createdByUserId: projectsTable.createdByUserId,
            createdAt: projectsTable.createdAt,
          })
          .from(projectsTable)
          .innerJoin(
            projectMembersTable,
            eq(projectMembersTable.projectId, projectsTable.id),
          )
          .where(eq(projectMembersTable.userId, user.id));

  const projectIds = projects.map((project) => project.id);
  const tasks =
    projectIds.length === 0
      ? []
      : user.role === "admin"
        ? await db
            .select()
            .from(tasksTable)
            .where(inArray(tasksTable.projectId, projectIds))
        : await db
            .select()
            .from(tasksTable)
            .where(
              and(
                inArray(tasksTable.projectId, projectIds),
                eq(tasksTable.assigneeUserId, user.id),
              ),
            );

  const today = new Date().toISOString().slice(0, 10);

  const projectsByStatus: Record<string, number> = {};
  for (const project of projects) {
    projectsByStatus[project.status] =
      (projectsByStatus[project.status] ?? 0) + 1;
  }

  const completedTasks = tasks.filter((t) => t.status === "concluida").length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "concluida",
  ).length;

  res.json({
    totalProjects: projects.length,
    activeProjects: projects.filter(
      (p) => p.status === "em_andamento" || p.status === "planejamento",
    ).length,
    completedProjects: projects.filter((p) => p.status === "concluido")
      .length,
    totalTasks: tasks.length,
    completedTasks,
    overdueTasks,
    projectsByStatus,
  });
});

router.get(
  "/dashboard/activity/filters",
  requireAuth,
  async (req, res): Promise<void> => {
    const options = await getActivityFilterOptions(req.appUser!);
    res.json(options);
  },
);

router.get(
  "/dashboard/activity",
  requireAuth,
  async (req, res): Promise<void> => {
    const query = activityQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const items = await buildUserActivityFeed(req.appUser!, query.data);
    res.json(items);
  },
);

router.get(
  "/dashboard/my-tasks/filters",
  requireAuth,
  async (req, res): Promise<void> => {
    const options = await getMyTasksFilterOptions(req.appUser!);
    res.json(options);
  },
);

router.get("/dashboard/my-tasks", requireAuth, async (req, res): Promise<void> => {
  const query = myTasksQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const tasks = await buildMyTasks(req.appUser!, query.data);
  res.json(tasks);
});

export default router;
