import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, projectMembersTable, projectsTable, stagesTable, tasksTable, usersTable } from "@db";
import {
  CreateProjectBody,
  DeleteProjectParams,
  GetProjectParams,
  GetProjectSummaryParams,
  ListProjectsQueryParams,
  ListProjectsResponse,
  UpdateProjectBody,
  UpdateProjectParams,
} from "@api/zod";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { toDateOnly } from "../lib/dates";
import { isEligibleProjectGestorForOrganizations, userHasProjectAccess } from "../lib/project-members";
import {
  getProjectOrganizationsByType,
  syncProjectOrganizations,
  validateProjectOrganizationSelection,
} from "../lib/project-organizations";
import {
  loadTaskAssigneeIdsForTasks,
  serializeTaskWithAssignees,
} from "../lib/task-assignees";
import { loadStageMemberIdsForStages } from "../lib/stage-members";
import {
  createNotificationsForUsers,
  notifyProjectMembers,
  runNotify,
} from "../lib/notifications";
import { serializeMembers } from "./project-members";

const router: IRouter = Router();

async function serializeProject(project: typeof projectsTable.$inferSelect) {
  const { empresaOrgIds, entePublicoOrgIds } =
    await getProjectOrganizationsByType(project.id);
  return {
    ...project,
    empresaOrgIds,
    entePublicoOrgIds,
  };
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(projectsTable)
    .where(
      query.data.status
        ? eq(projectsTable.status, query.data.status)
        : undefined,
    )
    .orderBy(projectsTable.createdAt);

  const memberships =
    req.appUser!.role === "admin"
      ? []
      : await db
          .select({ projectId: projectMembersTable.projectId })
          .from(projectMembersTable)
          .where(eq(projectMembersTable.userId, req.appUser!.id));

  const memberProjectIds = new Set(memberships.map((row) => row.projectId));
  const visible =
    req.appUser!.role === "admin"
      ? rows
      : rows.filter((project) => memberProjectIds.has(project.id));

  res.json(await Promise.all(visible.map((project) => serializeProject(project))));
});

router.post(
  "/projects",
  requireAuth,
  requireRole("admin", "gestor"),
  async (req, res): Promise<void> => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const orgSelection = z
      .object({
        gestorUserId: z.number().optional(),
        empresaOrgIds: z.array(z.number()).min(1).optional(),
        entePublicoOrgIds: z.array(z.number()).min(1).optional(),
      })
      .safeParse(req.body);

    const empresaOrgIds =
      orgSelection.success && orgSelection.data.empresaOrgIds
        ? orgSelection.data.empresaOrgIds
        : [parsed.data.empresaOrgId];
    const entePublicoOrgIds =
      orgSelection.success && orgSelection.data.entePublicoOrgIds
        ? orgSelection.data.entePublicoOrgIds
        : [parsed.data.entePublicoOrgId];

    const validatedOrgs = await validateProjectOrganizationSelection(
      empresaOrgIds,
      entePublicoOrgIds,
    );
    if (validatedOrgs.error) {
      res.status(400).json({ error: validatedOrgs.error });
      return;
    }

    const gestorUserId =
      orgSelection.success && orgSelection.data.gestorUserId != null
        ? orgSelection.data.gestorUserId
        : req.appUser!.id;

    const [gestor] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, gestorUserId));

    if (!gestor) {
      res.status(404).json({ error: "Gestor não encontrado." });
      return;
    }

    if (
      !isEligibleProjectGestorForOrganizations(
        gestor,
        validatedOrgs.organizationIds,
      )
    ) {
      res.status(400).json({
        error:
          "O gestor precisa ser admin do sistema ou gestor de uma das organizações do projeto.",
      });
      return;
    }

    const [project] = await db
      .insert(projectsTable)
      .values({
        ...parsed.data,
        empresaOrgId: empresaOrgIds[0]!,
        entePublicoOrgId: entePublicoOrgIds[0]!,
        dueDate: toDateOnly(parsed.data.dueDate),
        createdByUserId: req.appUser!.id,
      })
      .returning();

    await syncProjectOrganizations(project.id, validatedOrgs.organizationIds);

    await db.insert(projectMembersTable).values({
      projectId: project.id,
      userId: gestor.id,
      role: "gestor",
    });

    await runNotify(
      createNotificationsForUsers([gestor.id], {
        actorUserId: req.appUser!.id,
        type: "project_gestor_assigned",
        title: "Você é gestor de um novo projeto",
        message: `${req.appUser!.name} definiu você como gestor do projeto "${project.title}".`,
        projectId: project.id,
        link: `/projects/${project.id}`,
      }),
    );

    res.status(201).json(await serializeProject(project));
  },
);

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!(await userHasProjectAccess(req.appUser!, project))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const stageRows = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.projectId, project.id))
    .orderBy(stagesTable.order);

  const stageMemberMap = await loadStageMemberIdsForStages(
    stageRows.map((stage) => stage.id),
  );
  const stages = stageRows.map((stage) => ({
    ...stage,
    memberIds: stageMemberMap.get(stage.id) ?? [],
  }));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, project.id))
    .orderBy(asc(tasksTable.order), asc(tasksTable.createdAt));

  const assigneeMap = await loadTaskAssigneeIdsForTasks(tasks.map((task) => task.id));
  const serializedTasks = tasks.map((task) =>
    serializeTaskWithAssignees(task, assigneeMap.get(task.id) ?? []),
  );

  const members = await serializeMembers(project.id);

  res.json({
    project: await serializeProject(project),
    stages,
    tasks: serializedTasks,
    members,
  });
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (
    req.appUser!.role === "membro" ||
    !(await userHasProjectAccess(req.appUser!, existing))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set({ ...parsed.data, dueDate: toDateOnly(parsed.data.dueDate) })
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  await runNotify(
    notifyProjectMembers(
      {
        actorUserId: req.appUser!.id,
        type: "project_updated",
        title: "Projeto atualizado",
        message: `${req.appUser!.name} atualizou o projeto "${project.title}".`,
        projectId: project.id,
        link: `/projects/${project.id}`,
      },
      { excludeUserIds: [req.appUser!.id] },
    ),
  );

  res.json(project);
});

router.delete(
  "/projects/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteProjectParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [project] = await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, params.data.id))
      .returning();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.sendStatus(204);
  },
);

router.get(
  "/projects/:id/summary",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetProjectSummaryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const stages = await db
      .select()
      .from(stagesTable)
      .where(eq(stagesTable.projectId, params.data.id));

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.projectId, params.data.id));

    const completedTasks = tasks.filter((t) => t.status === "concluida").length;
    const tasksByStatus: Record<string, number> = {};
    for (const task of tasks) {
      tasksByStatus[task.status] = (tasksByStatus[task.status] ?? 0) + 1;
    }

    res.json({
      projectId: params.data.id,
      totalStages: stages.length,
      totalTasks: tasks.length,
      completedTasks,
      progressPercent:
        tasks.length === 0
          ? 0
          : Math.round((completedTasks / tasks.length) * 100),
      tasksByStatus,
    });
  },
);

export default router;
