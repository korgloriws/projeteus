import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  organizationPositionsTable,
  organizationSectorsTable,
  organizationsTable,
  projectMembersTable,
  projectsTable,
  usersTable,
} from "@db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  canManageProjectTeam,
  isEligibleProjectMember,
  isProjectGestor,
  userHasProjectAccess,
} from "../lib/project-members";
import {
  createNotificationsForUsers,
  runNotify,
} from "../lib/notifications";
import { serializeUser, loadUserProfile } from "./users";

const router: IRouter = Router();

const addProjectMemberSchema = z
  .object({
    userId: z.number().optional(),
    userIds: z.array(z.number()).min(1).optional(),
    role: z.enum(["gestor", "membro"]).optional(),
  })
  .refine((data) => data.userId != null || (data.userIds?.length ?? 0) > 0, {
    message: "Selecione ao menos um membro.",
  });

const updateProjectMemberSchema = z.object({
  role: z.enum(["gestor", "membro"]),
});

async function countProjectGestors(projectId: number) {
  const rows = await db
    .select()
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.role, "gestor"),
      ),
    );
  return rows.length;
}

async function loadProject(projectId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  return project ?? null;
}

async function serializeMembers(projectId: number) {
  const rows = await db
    .select({
      member: projectMembersTable,
      user: usersTable,
      org: organizationsTable,
      sector: organizationSectorsTable,
      position: organizationPositionsTable,
    })
    .from(projectMembersTable)
    .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
    .leftJoin(
      organizationsTable,
      eq(usersTable.organizationId, organizationsTable.id),
    )
    .leftJoin(
      organizationSectorsTable,
      eq(usersTable.sectorId, organizationSectorsTable.id),
    )
    .leftJoin(
      organizationPositionsTable,
      eq(usersTable.positionId, organizationPositionsTable.id),
    )
    .where(eq(projectMembersTable.projectId, projectId))
    .orderBy(projectMembersTable.createdAt);

  return rows.map((row) => ({
    id: row.member.id,
    projectId: row.member.projectId,
    userId: row.member.userId,
    role: row.member.role,
    createdAt: row.member.createdAt,
    user: serializeUser(row.user, row.org, row.sector, row.position),
  }));
}

router.get(
  "/projects/:projectId/members",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = z.object({ projectId: z.coerce.number() }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const project = await loadProject(params.data.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(await serializeMembers(params.data.projectId));
  },
);

router.post(
  "/projects/:projectId/members",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = z.object({ projectId: z.coerce.number() }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = addProjectMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const project = await loadProject(params.data.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!(await userHasProjectAccess(req.appUser!, project))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const actorIsGestor = await isProjectGestor(
      req.appUser!.id,
      params.data.projectId,
    );
    if (!canManageProjectTeam(req.appUser!, actorIsGestor)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const role = parsed.data.role ?? "membro";
    const userIds =
      parsed.data.userIds ?? (parsed.data.userId != null ? [parsed.data.userId] : []);

    const createdMembers = [];

    for (const userId of userIds) {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!(await isEligibleProjectMember(target, project))) {
        res.status(400).json({
          error: "O usuário precisa pertencer a uma das organizações do projeto.",
        });
        return;
      }

      const [existing] = await db
        .select()
        .from(projectMembersTable)
        .where(
          and(
            eq(projectMembersTable.projectId, params.data.projectId),
            eq(projectMembersTable.userId, userId),
          ),
        );

      if (existing) {
        continue;
      }

      const [created] = await db
        .insert(projectMembersTable)
        .values({
          projectId: params.data.projectId,
          userId,
          role,
        })
        .returning();

      createdMembers.push({
        id: created.id,
        projectId: created.projectId,
        userId: created.userId,
        role: created.role,
        createdAt: created.createdAt,
        user: await loadUserProfile(target),
      });
    }

    if (createdMembers.length === 0) {
      res.status(409).json({ error: "Os usuários selecionados já fazem parte deste projeto." });
      return;
    }

    await runNotify(
      createNotificationsForUsers(
        createdMembers.map((member) => member.userId),
        {
          actorUserId: req.appUser!.id,
          type: "member_added",
          title: "Você foi adicionado a um projeto",
          message: `${req.appUser!.name} adicionou você ao projeto "${project.title}".`,
          projectId: project.id,
          link: `/projects/${project.id}`,
        },
      ),
    );

    if (createdMembers.length === 1) {
      res.status(201).json(createdMembers[0]);
      return;
    }

    res.status(201).json(createdMembers);
  },
);

router.patch(
  "/projects/:projectId/members/:memberId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = z
      .object({ projectId: z.coerce.number(), memberId: z.coerce.number() })
      .safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = updateProjectMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const project = await loadProject(params.data.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actorIsGestor = await isProjectGestor(
      req.appUser!.id,
      params.data.projectId,
    );
    if (!canManageProjectTeam(req.appUser!, actorIsGestor)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [member] = await db
      .select()
      .from(projectMembersTable)
      .where(
        and(
          eq(projectMembersTable.id, params.data.memberId),
          eq(projectMembersTable.projectId, params.data.projectId),
        ),
      );

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (
      member.role === "gestor" &&
      parsed.data.role === "membro" &&
      (await countProjectGestors(params.data.projectId)) <= 1
    ) {
      res.status(400).json({
        error: "O projeto precisa ter ao menos um gestor.",
      });
      return;
    }

    const [updated] = await db
      .update(projectMembersTable)
      .set({ role: parsed.data.role })
      .where(eq(projectMembersTable.id, member.id))
      .returning();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, updated.userId));

    res.json({
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      role: updated.role,
      createdAt: updated.createdAt,
      user: user ? await loadUserProfile(user) : null,
    });
  },
);

router.delete(
  "/projects/:projectId/members/:memberId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = z
      .object({ projectId: z.coerce.number(), memberId: z.coerce.number() })
      .safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const project = await loadProject(params.data.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actorIsGestor = await isProjectGestor(
      req.appUser!.id,
      params.data.projectId,
    );
    if (!canManageProjectTeam(req.appUser!, actorIsGestor)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [member] = await db
      .select()
      .from(projectMembersTable)
      .where(
        and(
          eq(projectMembersTable.id, params.data.memberId),
          eq(projectMembersTable.projectId, params.data.projectId),
        ),
      );

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (
      member.role === "gestor" &&
      (await countProjectGestors(params.data.projectId)) <= 1
    ) {
      res.status(400).json({
        error: "Não é possível remover o único gestor do projeto.",
      });
      return;
    }

    await db
      .delete(projectMembersTable)
      .where(eq(projectMembersTable.id, member.id));

    res.sendStatus(204);
  },
);

export { serializeMembers };
export default router;
