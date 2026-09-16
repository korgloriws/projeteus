import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, commentsTable, projectsTable, tasksTable, usersTable } from "@db";
import {
  CreateCommentBody,
  DeleteCommentParams,
  ListCommentsQueryParams,
  ListCommentsResponse,
} from "@api/zod";
import { requireAuth } from "../middlewares/requireAuth";
import { userHasProjectAccess } from "../lib/project-members";
import {
  createNotificationsForUsers,
  getProjectMemberUserIds,
  runNotify,
} from "../lib/notifications";

const router: IRouter = Router();

const projectIdParams = z.object({
  projectId: z.coerce.number(),
});

const createProjectCommentBody = z.object({
  content: z.string().min(1),
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

async function serializeProjectComment(commentId: number) {
  const [row] = await db
    .select({ comment: commentsTable, user: usersTable })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.authorUserId, usersTable.id))
    .where(eq(commentsTable.id, commentId));

  if (!row) return null;

  return {
    id: row.comment.id,
    projectId: row.comment.projectId,
    taskId: row.comment.taskId,
    authorUserId: row.comment.authorUserId,
    content: row.comment.content,
    createdAt: row.comment.createdAt,
    author: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    },
  };
}

async function listProjectCommunications(projectId: number) {
  const rows = await db
    .select({ comment: commentsTable, user: usersTable })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.authorUserId, usersTable.id))
    .where(
      and(eq(commentsTable.projectId, projectId), isNull(commentsTable.taskId)),
    )
    .orderBy(commentsTable.createdAt);

  return rows.map((row) => ({
    id: row.comment.id,
    projectId: row.comment.projectId,
    taskId: row.comment.taskId,
    authorUserId: row.comment.authorUserId,
    content: row.comment.content,
    createdAt: row.comment.createdAt,
    author: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    },
  }));
}

async function resolveProjectId(
  projectId: number | undefined,
  taskId: number | undefined,
): Promise<number | null> {
  if (projectId !== undefined) return projectId;
  if (taskId !== undefined) {
    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    return task?.projectId ?? null;
  }
  return null;
}

router.get(
  "/projects/:projectId/comments",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams.safeParse(req.params);
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

    const comments = await listProjectCommunications(project.id);
    res.json(comments);
  },
);

router.post(
  "/projects/:projectId/comments",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = createProjectCommentBody.safeParse(req.body);
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

    const [comment] = await db
      .insert(commentsTable)
      .values({
        projectId: project.id,
        taskId: null,
        content: parsed.data.content.trim(),
        authorUserId: req.appUser!.id,
      })
      .returning();

    const serialized = await serializeProjectComment(comment.id);

    const actorName = req.appUser!.name;
    await runNotify(
      createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
        actorUserId: req.appUser!.id,
        type: "comment_created",
        title: "Novo comentário",
        message: `${actorName} comentou no projeto "${project.title}".`,
        projectId: project.id,
        link: `/projects/${project.id}`,
      }),
    );

    res.status(201).json(serialized);
  },
);

router.get("/comments", requireAuth, async (req, res): Promise<void> => {
  const query = ListCommentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const projectId = await resolveProjectId(
    query.data.projectId,
    query.data.taskId,
  );
  if (projectId === null) {
    res.status(400).json({ error: "projectId or taskId is required" });
    return;
  }

  const { project, allowed } = await loadAccessibleProject(req, projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (query.data.taskId !== undefined) {
    const rows = await db
      .select()
      .from(commentsTable)
      .where(
        and(
          eq(commentsTable.projectId, projectId),
          eq(commentsTable.taskId, query.data.taskId),
        ),
      )
      .orderBy(commentsTable.createdAt);
    res.json(ListCommentsResponse.parse(rows));
    return;
  }

  const comments = await listProjectCommunications(projectId);
  res.json(comments);
});

router.post("/comments", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const projectId = await resolveProjectId(
    parsed.data.projectId ?? undefined,
    parsed.data.taskId ?? undefined,
  );
  if (projectId === null) {
    res.status(400).json({ error: "projectId or taskId is required" });
    return;
  }

  const { project, allowed } = await loadAccessibleProject(req, projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({
      projectId,
      taskId: parsed.data.taskId ?? null,
      content: parsed.data.content,
      authorUserId: req.appUser!.id,
    })
    .returning();

  const actorName = req.appUser!.name;
  await runNotify(
    createNotificationsForUsers(await getProjectMemberUserIds(project.id), {
      actorUserId: req.appUser!.id,
      type: "comment_created",
      title: "Novo comentário",
      message: parsed.data.taskId
        ? `${actorName} comentou em uma tarefa do projeto "${project.title}".`
        : `${actorName} comentou no projeto "${project.title}".`,
      projectId: project.id,
      taskId: parsed.data.taskId ?? null,
      link: `/projects/${project.id}`,
    }),
  );

  if (!parsed.data.taskId) {
    const serialized = await serializeProjectComment(comment.id);
    res.status(201).json(serialized);
    return;
  }

  res.status(201).json(comment);
});

router.delete("/comments/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, params.data.id));

  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.projectId) {
    const { allowed } = await loadAccessibleProject(req, comment.projectId);
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  if (
    comment.authorUserId !== req.appUser!.id &&
    req.appUser!.role !== "admin"
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
