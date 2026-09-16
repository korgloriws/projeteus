import { Router, type IRouter, type RequestHandler } from "express";
import fs from "node:fs";
import multer from "multer";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  attachmentsTable,
  db,
  projectsTable,
  stagesTable,
  tasksTable,
  usersTable,
} from "@db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  canManageProjectTasks,
  userHasProjectAccess,
} from "../lib/project-members";
import {
  createNotificationsForUsers,
  getProjectMemberUserIds,
  runNotify,
} from "../lib/notifications";
import {
  absoluteStoredPath,
  buildStoredName,
  ensureProjectUploadDir,
  isAllowedFilename,
  MAX_ATTACHMENT_BYTES,
} from "../lib/uploads";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
});

const uploadSingle: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: `Arquivo excede o limite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB`,
        });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: "Falha no upload do arquivo" });
      return;
    }
    next();
  });
};

const projectIdParams = z.object({
  projectId: z.coerce.number().int().positive(),
});

const attachmentIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
  stageId: z.coerce.number().int().positive().optional(),
  taskId: z.coerce.number().int().positive().optional(),
  /** project = só do projeto; stage = etapa (sem tarefa); task = tarefa; all = tudo */
  scope: z.enum(["project", "stage", "task", "all"]).optional().default("all"),
});

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

function serializeAttachment(
  row: typeof attachmentsTable.$inferSelect,
  uploader?: { id: number; name: string; email: string } | null,
) {
  return {
    id: row.id,
    projectId: row.projectId,
    stageId: row.stageId,
    taskId: row.taskId,
    uploadedByUserId: row.uploadedByUserId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
    uploadedBy: uploader
      ? {
          id: uploader.id,
          name: uploader.name,
          email: uploader.email,
        }
      : null,
  };
}

router.get(
  "/projects/:projectId/attachments",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }

    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Parâmetros de listagem inválidos" });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(
      req,
      params.data.projectId,
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Sem acesso a este projeto" });
      return;
    }

    const conditions = [eq(attachmentsTable.projectId, project.id)];
    const { scope, stageId, taskId } = query.data;

    if (scope === "project") {
      conditions.push(isNull(attachmentsTable.stageId));
      conditions.push(isNull(attachmentsTable.taskId));
    } else if (scope === "stage") {
      if (!stageId) {
        res.status(400).json({ error: "stageId é obrigatório para scope=stage" });
        return;
      }
      conditions.push(eq(attachmentsTable.stageId, stageId));
      conditions.push(isNull(attachmentsTable.taskId));
    } else if (scope === "task") {
      if (!taskId) {
        res.status(400).json({ error: "taskId é obrigatório para scope=task" });
        return;
      }
      conditions.push(eq(attachmentsTable.taskId, taskId));
    } else {
      if (taskId) conditions.push(eq(attachmentsTable.taskId, taskId));
      else if (stageId) conditions.push(eq(attachmentsTable.stageId, stageId));
    }

    const rows = await db
      .select({
        attachment: attachmentsTable,
        uploader: usersTable,
      })
      .from(attachmentsTable)
      .innerJoin(
        usersTable,
        eq(attachmentsTable.uploadedByUserId, usersTable.id),
      )
      .where(and(...conditions))
      .orderBy(attachmentsTable.createdAt);

    res.json(
      rows.map((row) =>
        serializeAttachment(row.attachment, {
          id: row.uploader.id,
          name: row.uploader.name,
          email: row.uploader.email,
        }),
      ),
    );
  },
);

router.post(
  "/projects/:projectId/attachments",
  requireAuth,
  uploadSingle,
  async (req, res): Promise<void> => {
    const params = projectIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(
      req,
      params.data.projectId,
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Sem acesso a este projeto" });
      return;
    }

    const canManage = await canManageProjectTasks(req.appUser!, project);
    if (!canManage) {
      res
        .status(403)
        .json({ error: "Apenas gestores do projeto podem enviar anexos" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Arquivo obrigatório (campo file)" });
      return;
    }

    if (!isAllowedFilename(file.originalname)) {
      res.status(400).json({
        error:
          "Tipo de arquivo não permitido. Use PDF, TXT, CSV, XLSX, DOC, imagens, etc.",
      });
      return;
    }

    const stageIdRaw = req.body?.stageId;
    const taskIdRaw = req.body?.taskId;
    const stageId =
      stageIdRaw !== undefined && stageIdRaw !== "" && stageIdRaw !== null
        ? Number(stageIdRaw)
        : null;
    const taskId =
      taskIdRaw !== undefined && taskIdRaw !== "" && taskIdRaw !== null
        ? Number(taskIdRaw)
        : null;

    if (stageId !== null && Number.isNaN(stageId)) {
      res.status(400).json({ error: "stageId inválido" });
      return;
    }
    if (taskId !== null && Number.isNaN(taskId)) {
      res.status(400).json({ error: "taskId inválido" });
      return;
    }

    let resolvedStageId: number | null = stageId;
    let resolvedTaskId: number | null = taskId;

    if (taskId !== null) {
      const [task] = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.id, taskId));
      if (!task || task.projectId !== project.id) {
        res.status(400).json({ error: "Tarefa inválida para este projeto" });
        return;
      }
      resolvedTaskId = task.id;
      resolvedStageId = task.stageId;
    } else if (stageId !== null) {
      const [stage] = await db
        .select()
        .from(stagesTable)
        .where(eq(stagesTable.id, stageId));
      if (!stage || stage.projectId !== project.id) {
        res.status(400).json({ error: "Etapa inválida para este projeto" });
        return;
      }
      resolvedStageId = stage.id;
      resolvedTaskId = null;
    }

    ensureProjectUploadDir(project.id);
    const storedName = buildStoredName(file.originalname);
    const dest = absoluteStoredPath(project.id, storedName);

    try {
      fs.writeFileSync(dest, file.buffer);
    } catch (err) {
      console.error("[attachments] failed to write file", err);
      res.status(500).json({ error: "Falha ao salvar o arquivo" });
      return;
    }

    try {
      const [created] = await db
        .insert(attachmentsTable)
        .values({
          projectId: project.id,
          stageId: resolvedStageId,
          taskId: resolvedTaskId,
          uploadedByUserId: req.appUser!.id,
          originalName: file.originalname,
          storedName,
          mimeType: file.mimetype || "application/octet-stream",
          sizeBytes: file.size,
        })
        .returning();

      const scopeLabel = resolvedTaskId
        ? "tarefa"
        : resolvedStageId
          ? "etapa"
          : "projeto";

      await runNotify(
        createNotificationsForUsers(
          await getProjectMemberUserIds(project.id),
          {
            actorUserId: req.appUser!.id,
            type: "attachment_uploaded",
            title: "Novo anexo",
            message: `${req.appUser!.name} enviou "${file.originalname}" (${scopeLabel}).`,
            projectId: project.id,
            stageId: resolvedStageId,
            taskId: resolvedTaskId,
            link: `/projects/${project.id}`,
          },
        ),
      );

      res.status(201).json(
        serializeAttachment(created, {
          id: req.appUser!.id,
          name: req.appUser!.name,
          email: req.appUser!.email,
        }),
      );
    } catch (err) {
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
      console.error("[attachments] failed to insert metadata", err);
      res.status(500).json({ error: "Falha ao registrar o anexo" });
    }
  },
);

router.get(
  "/attachments/:id/file",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = attachmentIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const [row] = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, params.data.id));

    if (!row) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(req, row.projectId);
    if (!project || !allowed) {
      res.status(403).json({ error: "Sem acesso a este anexo" });
      return;
    }

    const filePath = absoluteStoredPath(row.projectId, row.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Arquivo físico não encontrado" });
      return;
    }

    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
    );
    res.setHeader("Content-Length", String(row.sizeBytes));
    fs.createReadStream(filePath).pipe(res);
  },
);

router.delete(
  "/attachments/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = attachmentIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const [row] = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, params.data.id));

    if (!row) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }

    const { project, allowed } = await loadAccessibleProject(req, row.projectId);
    if (!project || !allowed) {
      res.status(403).json({ error: "Sem acesso a este anexo" });
      return;
    }

    const canManage = await canManageProjectTasks(req.appUser!, project);
    const isUploader = row.uploadedByUserId === req.appUser!.id;
    if (!canManage && !isUploader) {
      res.status(403).json({ error: "Sem permissão para excluir este anexo" });
      return;
    }

    await db
      .delete(attachmentsTable)
      .where(eq(attachmentsTable.id, row.id));

    const filePath = absoluteStoredPath(row.projectId, row.storedName);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error("[attachments] failed to delete file", err);
    }

    res.status(204).end();
  },
);

export default router;
