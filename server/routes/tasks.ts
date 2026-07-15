import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, projectsTable, stagesTable, tasksTable } from "@db";
import {
  CreateTaskBody,
  CreateTaskParams,
  DeleteTaskParams,
  ListTasksParams,
  MoveTaskParams,
  UpdateTaskBody,
  UpdateTaskParams,
} from "@api/zod";
import { requireAuth } from "../middlewares/requireAuth";
import { toDateOnly } from "../lib/dates";
import {
  areValidTaskAssignees,
  canManageProjectTasks,
  userHasProjectAccess,
} from "../lib/project-members";
import {
  loadTaskAssigneeIdsForTasks,
  serializeTaskWithAssignees,
  syncTaskAssignees,
} from "../lib/task-assignees";
import {
  createNotificationsForUsers,
  getProjectMemberUserIds,
  runNotify,
} from "../lib/notifications";

const router: IRouter = Router();

const assigneeIdsSchema = z
  .object({
    assigneeUserIds: z.array(z.number()).min(1),
  })
  .or(
    z.object({
      assigneeUserId: z.number(),
    }),
  );

function resolveAssigneeUserIds(
  data: z.infer<typeof assigneeIdsSchema>,
): number[] {
  if ("assigneeUserIds" in data) return data.assigneeUserIds;
  return [data.assigneeUserId];
}

const reorderTaskSchema = z.object({
  order: z.number(),
});

const moveTaskExtrasSchema = z.object({
  stageId: z.number(),
  order: z.number().optional(),
});

async function getNextTaskOrder(stageId: number) {
  const stageTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.stageId, stageId));

  if (stageTasks.length === 0) return 0;
  return Math.max(...stageTasks.map((task) => task.order)) + 1;
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

async function loadTaskWithProject(taskId: number) {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));
  if (!task) return { task: null, project: null };
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId));
  return { task, project: project ?? null };
}


async function revertStageCompletionIfNeeded(
  stageId: number,
): Promise<{ reverted: boolean; stageName: string }> {
  const [stage] = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.id, stageId));

  if (!stage || stage.status !== "concluido") {
    return { reverted: false, stageName: stage?.name ?? "" };
  }

  const stageTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.stageId, stageId));

  const hasOpenTask = stageTasks.some((task) => task.status !== "concluida");
  if (!hasOpenTask) {
    return { reverted: false, stageName: stage.name };
  }

  await db
    .update(stagesTable)
    .set({ status: "em_andamento" })
    .where(eq(stagesTable.id, stageId));

  return { reverted: true, stageName: stage.name };
}

router.get(
  "/stages/:stageId/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListTasksParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const { stage, project } = await loadStageWithProject(
      params.data.stageId,
    );
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if (!project || !(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const rows = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.stageId, params.data.stageId))
      .orderBy(asc(tasksTable.order), asc(tasksTable.createdAt));

    const assigneeMap = await loadTaskAssigneeIdsForTasks(rows.map((task) => task.id));

    res.json(
      rows.map((task) =>
        serializeTaskWithAssignees(task, assigneeMap.get(task.id) ?? []),
      ),
    );
  },
);

router.post(
  "/stages/:stageId/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateTaskParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const extras = assigneeIdsSchema.safeParse(req.body);
    if (!extras.success) {
      res.status(400).json({ error: "Selecione ao menos um responsável pela tarefa." });
      return;
    }

    const assigneeUserIds = resolveAssigneeUserIds(extras.data);

    const { stage, project } = await loadStageWithProject(
      params.data.stageId,
    );
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if (
      !project ||
      !(await userHasProjectAccess(req.appUser!, project)) ||
      !(await canManageProjectTasks(req.appUser!, project))
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!(await areValidTaskAssignees(project, assigneeUserIds))) {
      res.status(400).json({
        error: "Os responsáveis precisam fazer parte da equipe do projeto.",
      });
      return;
    }

    const nextOrder = await getNextTaskOrder(stage.id);

    const [task] = await db
      .insert(tasksTable)
      .values({
        ...parsed.data,
        assigneeUserId: assigneeUserIds[0] ?? null,
        dueDate: toDateOnly(parsed.data.dueDate),
        stageId: stage.id,
        projectId: stage.projectId,
        order: nextOrder,
      })
      .returning();

    await syncTaskAssignees(task.id, assigneeUserIds);

    const actorId = req.appUser!.id;
    const actorName = req.appUser!.name;
    const link = `/projects/${stage.projectId}`;
    const memberIds = await getProjectMemberUserIds(stage.projectId);
    const assigneeSet = new Set(assigneeUserIds);

    await runNotify(
      createNotificationsForUsers(assigneeUserIds, {
        actorUserId: actorId,
        type: "task_assigned",
        title: "Nova tarefa atribuída a você",
        message: `${actorName} atribuiu você à tarefa "${task.title}" na etapa "${stage.name}".`,
        projectId: stage.projectId,
        stageId: stage.id,
        taskId: task.id,
        link,
      }),
    );
    await runNotify(
      createNotificationsForUsers(
        memberIds.filter((id) => !assigneeSet.has(id)),
        {
          actorUserId: actorId,
          type: "task_created",
          title: "Nova tarefa no projeto",
          message: `${actorName} criou a tarefa "${task.title}" na etapa "${stage.name}".`,
          projectId: stage.projectId,
          stageId: stage.id,
          taskId: task.id,
          link,
        },
      ),
    );

    const stageRevert = await revertStageCompletionIfNeeded(stage.id);
    if (stageRevert.reverted) {
      await runNotify(
        createNotificationsForUsers(memberIds, {
          actorUserId: actorId,
          type: "stage_updated",
          title: "Etapa reaberta",
          message: `${actorName} adicionou uma nova tarefa e a etapa "${stage.name}" voltou para "em andamento".`,
          projectId: stage.projectId,
          stageId: stage.id,
          link,
        }),
      );
    }

    const assigneeMap = await loadTaskAssigneeIdsForTasks([task.id]);
    res.status(201).json(
      serializeTaskWithAssignees(task, assigneeMap.get(task.id) ?? assigneeUserIds),
    );
  },
);

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { task, project } = await loadTaskWithProject(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!project || !(await userHasProjectAccess(req.appUser!, project))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const canManage = await canManageProjectTasks(req.appUser!, project);
  if (!canManage) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const previousStatus = task.status;
  const previousAssignees = (
    await loadTaskAssigneeIdsForTasks([task.id])
  ).get(task.id) ?? [];

  const assigneeExtras = assigneeIdsSchema.safeParse(req.body);
  let assigneeUserIds: number[] | undefined;
  if (assigneeExtras.success) {
    assigneeUserIds = resolveAssigneeUserIds(assigneeExtras.data);
    if (!(await areValidTaskAssignees(project, assigneeUserIds))) {
      res.status(400).json({
        error: "Os responsáveis precisam fazer parte da equipe do projeto.",
      });
      return;
    }
  } else if (
    parsed.data.assigneeUserId !== undefined &&
    parsed.data.assigneeUserId !== null
  ) {
    assigneeUserIds = [parsed.data.assigneeUserId];
    if (!(await areValidTaskAssignees(project, assigneeUserIds))) {
      res.status(400).json({
        error: "O responsável precisa fazer parte da equipe do projeto.",
      });
      return;
    }
  }

  const updateData = { ...parsed.data, dueDate: toDateOnly(parsed.data.dueDate) };
  if (assigneeUserIds) {
    updateData.assigneeUserId = assigneeUserIds[0] ?? null;
  }

  const [updated] = await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (assigneeUserIds) {
    await syncTaskAssignees(updated.id, assigneeUserIds);
  }

  const actorId = req.appUser!.id;
  const actorName = req.appUser!.name;
  const link = `/projects/${project.id}`;
  const previousAssigneeSet = new Set(previousAssignees);
  const newlyAssigned = (assigneeUserIds ?? []).filter(
    (id) => !previousAssigneeSet.has(id),
  );
  const newlyAssignedSet = new Set(newlyAssigned);
  const becameCompleted =
    updated.status === "concluida" && previousStatus !== "concluida";

  await runNotify(
    createNotificationsForUsers(newlyAssigned, {
      actorUserId: actorId,
      type: "task_assigned",
      title: "Nova tarefa atribuída a você",
      message: `${actorName} atribuiu você à tarefa "${updated.title}".`,
      projectId: project.id,
      stageId: updated.stageId,
      taskId: updated.id,
      link,
    }),
  );

  const memberIds = await getProjectMemberUserIds(project.id);
  await runNotify(
    createNotificationsForUsers(
      memberIds.filter((id) => !newlyAssignedSet.has(id)),
      {
        actorUserId: actorId,
        type: becameCompleted ? "task_completed" : "task_updated",
        title: becameCompleted ? "Tarefa concluída" : "Tarefa atualizada",
        message: becameCompleted
          ? `${actorName} concluiu a tarefa "${updated.title}".`
          : `${actorName} atualizou a tarefa "${updated.title}".`,
        projectId: project.id,
        stageId: updated.stageId,
        taskId: updated.id,
        link,
      },
    ),
  );

  const stageRevert = await revertStageCompletionIfNeeded(updated.stageId);
  if (stageRevert.reverted) {
    await runNotify(
      createNotificationsForUsers(memberIds, {
        actorUserId: actorId,
        type: "stage_updated",
        title: "Etapa reaberta",
        message: `A etapa "${stageRevert.stageName}" voltou para "em andamento" porque uma tarefa deixou de estar concluída.`,
        projectId: project.id,
        stageId: updated.stageId,
        link,
      }),
    );
  }

  const assigneeMap = await loadTaskAssigneeIdsForTasks([updated.id]);
  res.json(
    serializeTaskWithAssignees(updated, assigneeMap.get(updated.id) ?? []),
  );
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { task, project } = await loadTaskWithProject(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (
    !project ||
    !(await userHasProjectAccess(req.appUser!, project)) ||
    !(await canManageProjectTasks(req.appUser!, project))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));

  const actorName = req.appUser!.name;
  await runNotify(
    createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
      actorUserId: req.appUser!.id,
      type: "task_deleted",
      title: "Tarefa removida",
      message: `${actorName} removeu a tarefa "${task.title}".`,
      projectId: project.id,
      link: `/projects/${project.id}`,
    }),
  );

  res.sendStatus(204);
});

router.patch("/tasks/:id/move", requireAuth, async (req, res): Promise<void> => {
  const params = MoveTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = moveTaskExtrasSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { task, project } = await loadTaskWithProject(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (
    !project ||
    !(await userHasProjectAccess(req.appUser!, project)) ||
    !(await canManageProjectTasks(req.appUser!, project))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [targetStage] = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.id, parsed.data.stageId));

  if (!targetStage || targetStage.projectId !== task.projectId) {
    res.status(400).json({ error: "Target stage not found" });
    return;
  }

  const order =
    parsed.data.order ??
    (targetStage.id === task.stageId
      ? task.order
      : await getNextTaskOrder(targetStage.id));

  const stageChanged = targetStage.id !== task.stageId;

  const [updated] = await db
    .update(tasksTable)
    .set({
      stageId: targetStage.id,
      projectId: targetStage.projectId,
      order,
    })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (stageChanged) {
    const actorName = req.appUser!.name;
    await runNotify(
      createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
        actorUserId: req.appUser!.id,
        type: "task_moved",
        title: "Tarefa movida",
        message: `${actorName} moveu a tarefa "${updated.title}" para a etapa "${targetStage.name}".`,
        projectId: project.id,
        stageId: targetStage.id,
        taskId: updated.id,
        link: `/projects/${project.id}`,
      }),
    );
  }

  if (stageChanged) {
    const stageRevert = await revertStageCompletionIfNeeded(targetStage.id);
    if (stageRevert.reverted) {
      await runNotify(
        createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
          actorUserId: req.appUser!.id,
          type: "stage_updated",
          title: "Etapa reaberta",
          message: `${req.appUser!.name} moveu uma tarefa em aberto e a etapa "${stageRevert.stageName}" voltou para "em andamento".`,
          projectId: project.id,
          stageId: targetStage.id,
          link: `/projects/${project.id}`,
        }),
      );
    }
  }

  const assigneeMap = await loadTaskAssigneeIdsForTasks([updated.id]);
  res.json(
    serializeTaskWithAssignees(updated, assigneeMap.get(updated.id) ?? []),
  );
});

router.patch("/tasks/:id/reorder", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = reorderTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { task, project } = await loadTaskWithProject(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (
    !project ||
    !(await userHasProjectAccess(req.appUser!, project)) ||
    !(await canManageProjectTasks(req.appUser!, project))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(tasksTable)
    .set({ order: parsed.data.order })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  const assigneeMap = await loadTaskAssigneeIdsForTasks([updated.id]);
  res.json(
    serializeTaskWithAssignees(updated, assigneeMap.get(updated.id) ?? []),
  );
});

export default router;
