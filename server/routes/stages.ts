import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, projectsTable, stagesTable, tasksTable } from "@db";
import {
  CreateStageBody,
  CreateStageParams,
  DeleteStageParams,
  ListStagesParams,
  ListStagesResponse,
  ReorderStageBody,
  ReorderStageParams,
  UpdateStageBody,
  UpdateStageParams,
} from "@api/zod";
import { requireAuth } from "../middlewares/requireAuth";
import { toDateOnly } from "../lib/dates";
import {
  userHasProjectAccess,
  canManageProjectTasks,
  isProjectMember,
} from "../lib/project-members";
import {
  loadStageMemberIds,
  loadStageMemberIdsForStages,
  replaceStageMembers,
} from "../lib/stage-members";
import {
  createNotificationsForUsers,
  getProjectMemberUserIds,
  runNotify,
} from "../lib/notifications";

const router: IRouter = Router();

const stageMembersSchema = z.object({
  memberIds: z.array(z.number().int()).min(1),
});

const optionalStageMembersSchema = z.object({
  memberIds: z.array(z.number().int()).min(1).optional(),
});

async function validateStageMembers(
  projectId: number,
  memberIds: number[],
): Promise<boolean> {
  for (const userId of memberIds) {
    if (!(await isProjectMember(userId, projectId))) return false;
  }
  return true;
}

async function loadAccessibleProject(req: any, projectId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  if (!project) return { project: null, allowed: false };
  return {
    project,
    allowed: await userHasProjectAccess(req.appUser!, project),
  };
}

async function loadStageWithProject(stageId: number) {
  const [stage] = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.id, stageId));
  if (!stage) return { stage: null, project: null };
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, stage.projectId));
  return { stage, project: project ?? null };
}

router.get(
  "/projects/:projectId/stages",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListStagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(
      req,
      params.data.projectId,
    );
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const rows = await db
      .select()
      .from(stagesTable)
      .where(eq(stagesTable.projectId, params.data.projectId))
      .orderBy(stagesTable.order);

    const memberMap = await loadStageMemberIdsForStages(
      rows.map((row) => row.id),
    );
    const parsed = ListStagesResponse.parse(rows).map((stage, index) => ({
      ...stage,
      memberIds: memberMap.get(rows[index].id) ?? [],
    }));

    res.json(parsed);
  },
);

router.post(
  "/projects/:projectId/stages",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateStageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateStageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(
      req,
      params.data.projectId,
    );
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!(await canManageProjectTasks(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const membersParsed = stageMembersSchema.safeParse(req.body);
    if (!membersParsed.success) {
      res.status(400).json({
        error: "Atribua no mínimo um membro à etapa.",
      });
      return;
    }

    if (!(await validateStageMembers(project.id, membersParsed.data.memberIds))) {
      res.status(400).json({
        error: "Os membros da etapa precisam fazer parte da equipe do projeto.",
      });
      return;
    }

    const [stage] = await db
      .insert(stagesTable)
      .values({
        ...parsed.data,
        dueDate: toDateOnly(parsed.data.dueDate),
        projectId: params.data.projectId,
      })
      .returning();

    await replaceStageMembers(stage.id, membersParsed.data.memberIds);

    const actorId = req.appUser!.id;
    const actorName = req.appUser!.name;
    const link = `/projects/${project.id}`;
    const stageMemberSet = new Set(membersParsed.data.memberIds);

    await runNotify(
      createNotificationsForUsers(membersParsed.data.memberIds, {
        actorUserId: actorId,
        type: "stage_assigned",
        title: "Você foi adicionado a uma etapa",
        message: `${actorName} adicionou você à etapa "${stage.name}".`,
        projectId: project.id,
        stageId: stage.id,
        link,
      }),
    );
    await runNotify(
      createNotificationsForUsers(
        (await getProjectMemberUserIds(project.id)).filter(
          (id) => !stageMemberSet.has(id),
        ),
        {
          actorUserId: actorId,
          type: "stage_created",
          title: "Nova etapa no projeto",
          message: `${actorName} criou a etapa "${stage.name}".`,
          projectId: project.id,
          stageId: stage.id,
          link,
        },
      ),
    );

    res.status(201).json({ ...stage, memberIds: membersParsed.data.memberIds });
  },
);

router.patch(
  "/stages/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateStageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateStageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { stage, project } = await loadStageWithProject(params.data.id);
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if (!project || !(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!(await canManageProjectTasks(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const membersParsed = optionalStageMembersSchema.safeParse(req.body);
    if (!membersParsed.success) {
      res.status(400).json({
        error: "Atribua no mínimo um membro à etapa.",
      });
      return;
    }
    if (
      membersParsed.data.memberIds &&
      !(await validateStageMembers(project.id, membersParsed.data.memberIds))
    ) {
      res.status(400).json({
        error: "Os membros da etapa precisam fazer parte da equipe do projeto.",
      });
      return;
    }

    const previousStatus = stage.status;
    const previousStageMembers = await loadStageMemberIds(stage.id);

    if (parsed.data.status === "concluido") {
      const stageTasks = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.stageId, stage.id));

      if (stageTasks.length === 0) {
        res.status(400).json({
          error: "Adicione tarefas à etapa antes de concluí-la.",
        });
        return;
      }

      const pendingTasks = stageTasks.filter((task) => task.status !== "concluida");
      if (pendingTasks.length > 0) {
        res.status(400).json({
          error: `Conclua todas as tarefas antes de finalizar a etapa. ${pendingTasks.length} tarefa(s) pendente(s).`,
        });
        return;
      }
    }

    const [updated] = await db
      .update(stagesTable)
      .set({ ...parsed.data, dueDate: toDateOnly(parsed.data.dueDate) })
      .where(eq(stagesTable.id, params.data.id))
      .returning();

    if (membersParsed.data.memberIds) {
      await replaceStageMembers(updated.id, membersParsed.data.memberIds);
    }

    const actorId = req.appUser!.id;
    const actorName = req.appUser!.name;
    const link = `/projects/${project.id}`;
    const previousMemberSet = new Set(previousStageMembers);
    const newlyAssigned = (membersParsed.data.memberIds ?? []).filter(
      (id) => !previousMemberSet.has(id),
    );
    const newlyAssignedSet = new Set(newlyAssigned);
    const becameCompleted =
      updated.status === "concluido" && previousStatus !== "concluido";

    await runNotify(
      createNotificationsForUsers(newlyAssigned, {
        actorUserId: actorId,
        type: "stage_assigned",
        title: "Você foi adicionado a uma etapa",
        message: `${actorName} adicionou você à etapa "${updated.name}".`,
        projectId: project.id,
        stageId: updated.id,
        link,
      }),
    );
    await runNotify(
      createNotificationsForUsers(
        (await getProjectMemberUserIds(project.id)).filter(
          (id) => !newlyAssignedSet.has(id),
        ),
        {
          actorUserId: actorId,
          type: becameCompleted ? "stage_completed" : "stage_updated",
          title: becameCompleted ? "Etapa concluída" : "Etapa atualizada",
          message: becameCompleted
            ? `${actorName} concluiu a etapa "${updated.name}".`
            : `${actorName} atualizou a etapa "${updated.name}".`,
          projectId: project.id,
          stageId: updated.id,
          link,
        },
      ),
    );

    const memberIds = await loadStageMemberIds(updated.id);
    res.json({ ...updated, memberIds });
  },
);

router.delete(
  "/stages/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteStageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const { stage, project } = await loadStageWithProject(params.data.id);
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if (!project || !(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!(await canManageProjectTasks(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(stagesTable).where(eq(stagesTable.id, params.data.id));

    const actorName = req.appUser!.name;
    await runNotify(
      createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
        actorUserId: req.appUser!.id,
        type: "stage_deleted",
        title: "Etapa removida",
        message: `${actorName} removeu a etapa "${stage.name}".`,
        projectId: project.id,
        link: `/projects/${project.id}`,
      }),
    );

    res.sendStatus(204);
  },
);

router.patch(
  "/stages/:id/reorder",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ReorderStageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = ReorderStageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { stage, project } = await loadStageWithProject(params.data.id);
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if (!project || !(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!(await canManageProjectTasks(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [updated] = await db
      .update(stagesTable)
      .set({ order: parsed.data.order })
      .where(eq(stagesTable.id, params.data.id))
      .returning();

    res.json(updated);
  },
);

export default router;
