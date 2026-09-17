import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  organizationSectorsTable,
  organizationsTable,
  projectInvitesTable,
  projectMembersTable,
  projectsTable,
  usersTable,
} from "@db";
import { requireAuth, loadOptionalUser } from "../middlewares/requireAuth";
import {
  buildInviteToken,
  buildPublicProjectSnapshot,
  canSendProjectInvites,
  findPendingInviteConflict,
  inviteExpiresAt,
  inviteLinkPath,
  isOpenShareInvite,
  listProjectInvites,
  loadInviteByToken,
  serializeInvite,
} from "../lib/project-invites";
import { isProjectMember } from "../lib/project-members";
import { getProjectOrganizationIds } from "../lib/project-organizations";
import {
  createNotificationsForUsers,
  runNotify,
} from "../lib/notifications";

const router: IRouter = Router();

const createInvitesBody = z
  .object({
    channel: z.enum(["internal", "external"]),
    role: z.enum(["gestor", "membro"]).default("membro"),
    userIds: z.array(z.number()).optional(),
    emails: z
      .array(
        z.object({
          email: z.string().email(),
          name: z.string().min(1).optional(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "internal" && !(data.userIds?.length)) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione ao menos um usuário para convite interno.",
        path: ["userIds"],
      });
    }
  });

function projectIdParams(raw: unknown) {
  return z.object({ id: z.coerce.number() }).safeParse(raw);
}

function tokenParams(raw: unknown) {
  return z.object({ token: z.string().min(16) }).safeParse(raw);
}

function inviteIdParams(raw: unknown) {
  return z.object({ inviteId: z.coerce.number() }).safeParse(raw);
}

router.get(
  "/projects/:id/invite-candidates",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams(req.params);
    if (!params.success) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }

    if (!(await canSendProjectInvites(req.appUser!, project.id))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const projectOrgIds = await getProjectOrganizationIds(project.id);
    const actorOrgId = req.appUser!.organizationId;

    const relevantOrgIds = [
      ...new Set(
        [actorOrgId, ...projectOrgIds].filter(
          (id): id is number => typeof id === "number",
        ),
      ),
    ];

    const orgs =
      relevantOrgIds.length === 0
        ? await db.select().from(organizationsTable)
        : await db
            .select()
            .from(organizationsTable)
            .where(inArray(organizationsTable.id, relevantOrgIds));

    const orgIds = orgs.map((org) => org.id);
    const sectors =
      orgIds.length === 0
        ? []
        : await db
            .select()
            .from(organizationSectorsTable)
            .where(inArray(organizationSectorsTable.organizationId, orgIds));

    const users =
      orgIds.length === 0
        ? await db.select().from(usersTable)
        : await db
            .select()
            .from(usersTable)
            .where(inArray(usersTable.organizationId, orgIds));

    const members = await db
      .select({ userId: projectMembersTable.userId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.projectId, project.id));
    const memberIds = new Set(members.map((row) => row.userId));

    const tree = orgs.map((org) => {
      const orgSectors = sectors.filter(
        (sector) => sector.organizationId === org.id,
      );
      const orgUsers = users.filter(
        (user) =>
          user.organizationId === org.id &&
          user.id !== req.appUser!.id &&
          !memberIds.has(user.id),
      );

      return {
        id: org.id,
        name: org.name,
        type: org.type,
        sectors: [
          ...orgSectors.map((sector) => ({
            id: sector.id,
            name: sector.name,
            users: orgUsers
              .filter((user) => user.sectorId === sector.id)
              .map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              })),
          })),
          {
            id: null,
            name: "Sem setor",
            users: orgUsers
              .filter((user) => user.sectorId == null)
              .map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              })),
          },
        ].filter((sector) => sector.users.length > 0),
      };
    });

    res.json({
      organizations: tree.filter((org) => org.sectors.length > 0),
    });
  },
);

router.get(
  "/projects/:id/invites",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams(req.params);
    if (!params.success) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }

    if (!(await canSendProjectInvites(req.appUser!, project.id))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(await listProjectInvites(project.id));
  },
);

router.post(
  "/projects/:id/invites",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = projectIdParams(req.params);
    if (!params.success) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }

    const parsed = createInvitesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }

    if (!(await canSendProjectInvites(req.appUser!, project.id))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const created = [];
    const errors: string[] = [];

    if (parsed.data.channel === "internal") {
      const userIds = [...new Set(parsed.data.userIds ?? [])];
      const users = await db
        .select()
        .from(usersTable)
        .where(inArray(usersTable.id, userIds));
      const userById = new Map(users.map((user) => [user.id, user]));

      for (const userId of userIds) {
        const user = userById.get(userId);
        if (!user) {
          errors.push(`Usuário ${userId} não encontrado.`);
          continue;
        }
        if (await isProjectMember(user.id, project.id)) {
          errors.push(`${user.name} já participa do projeto.`);
          continue;
        }
        const conflict = await findPendingInviteConflict({
          projectId: project.id,
          email: user.email,
          userId: user.id,
        });
        if (conflict) {
          errors.push(`${user.name} já possui convite pendente.`);
          continue;
        }

        const token = buildInviteToken();
        const [invite] = await db
          .insert(projectInvitesTable)
          .values({
            token,
            projectId: project.id,
            invitedByUserId: req.appUser!.id,
            inviteeUserId: user.id,
            inviteeEmail: user.email.trim().toLowerCase(),
            inviteeName: user.name,
            role: parsed.data.role,
            channel: "internal",
            status: "pending",
            expiresAt: inviteExpiresAt(),
          })
          .returning();

        await runNotify(
          createNotificationsForUsers([user.id], {
            actorUserId: req.appUser!.id,
            type: "project_invite",
            title: "Convite para projeto",
            message: `${req.appUser!.name} convidou você para o projeto "${project.title}" como ${parsed.data.role}.`,
            projectId: project.id,
            link: inviteLinkPath(token),
          }),
        );

        created.push(
          serializeInvite(invite, {
            projectTitle: project.title,
            invitedByName: req.appUser!.name,
            inviteeNameResolved: user.name,
          }),
        );
      }
    } else {
      const emails = parsed.data.emails ?? [];

      if (emails.length === 0) {
        const token = buildInviteToken();
        const [invite] = await db
          .insert(projectInvitesTable)
          .values({
            token,
            projectId: project.id,
            invitedByUserId: req.appUser!.id,
            inviteeUserId: null,
            inviteeEmail: "",
            inviteeName: null,
            role: parsed.data.role,
            channel: "external",
            status: "pending",
            expiresAt: inviteExpiresAt(),
          })
          .returning();

        created.push(
          serializeInvite(invite, {
            projectTitle: project.title,
            invitedByName: req.appUser!.name,
            inviteeNameResolved: "Link compartilhável",
          }),
        );
      } else {
        for (const entry of emails) {
          const email = entry.email.trim().toLowerCase();
          const [existingUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email));

          if (existingUser && (await isProjectMember(existingUser.id, project.id))) {
            errors.push(`${email} já participa do projeto.`);
            continue;
          }

          const conflict = await findPendingInviteConflict({
            projectId: project.id,
            email,
            userId: existingUser?.id ?? null,
          });
          if (conflict) {
            errors.push(`${email} já possui convite pendente.`);
            continue;
          }

          const token = buildInviteToken();
          const [invite] = await db
            .insert(projectInvitesTable)
            .values({
              token,
              projectId: project.id,
              invitedByUserId: req.appUser!.id,
              inviteeUserId: existingUser?.id ?? null,
              inviteeEmail: email,
              inviteeName: entry.name?.trim() || existingUser?.name || null,
              role: parsed.data.role,
              channel: "external",
              status: "pending",
              expiresAt: inviteExpiresAt(),
            })
            .returning();

          if (existingUser) {
            await runNotify(
              createNotificationsForUsers([existingUser.id], {
                actorUserId: req.appUser!.id,
                type: "project_invite",
                title: "Convite para projeto",
                message: `${req.appUser!.name} convidou você para o projeto "${project.title}" como ${parsed.data.role}.`,
                projectId: project.id,
                link: inviteLinkPath(token),
              }),
            );
          }

          created.push(
            serializeInvite(invite, {
              projectTitle: project.title,
              invitedByName: req.appUser!.name,
              inviteeNameResolved:
                entry.name?.trim() || existingUser?.name || null,
            }),
          );
        }
      }
    }

    if (created.length === 0) {
      res.status(400).json({
        error: errors[0] ?? "Nenhum convite foi criado.",
        errors,
      });
      return;
    }

    res.status(201).json({ invites: created, errors });
  },
);

router.post(
  "/projects/:id/invites/:inviteId/revoke",
  requireAuth,
  async (req, res): Promise<void> => {
    const projectParams = projectIdParams(req.params);
    const inviteParams = inviteIdParams(req.params);
    if (!projectParams.success || !inviteParams.success) {
      res.status(400).json({ error: "Parâmetros inválidos" });
      return;
    }

    if (!(await canSendProjectInvites(req.appUser!, projectParams.data.id))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [invite] = await db
      .select()
      .from(projectInvitesTable)
      .where(
        and(
          eq(projectInvitesTable.id, inviteParams.data.inviteId),
          eq(projectInvitesTable.projectId, projectParams.data.id),
        ),
      );

    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado" });
      return;
    }

    if (invite.status !== "pending") {
      res.status(400).json({ error: "Só é possível revogar convites pendentes." });
      return;
    }

    const [updated] = await db
      .update(projectInvitesTable)
      .set({ status: "revoked" })
      .where(eq(projectInvitesTable.id, invite.id))
      .returning();

    res.json(serializeInvite(updated));
  },
);

router.get("/invites/:token", async (req, res): Promise<void> => {
  const params = tokenParams(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const invite = await loadInviteByToken(params.data.token);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }

  const snapshot = await buildPublicProjectSnapshot(invite.projectId);
  if (!snapshot) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  const [inviter] = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, invite.invitedByUserId));

  const viewer = await loadOptionalUser(req);
  const viewerIsMember = viewer
    ? await isProjectMember(viewer.id, invite.projectId)
    : false;

  res.json({
    invite: serializeInvite(invite, {
      projectTitle: snapshot.title,
      invitedByName: inviter?.name,
      inviteeNameResolved: isOpenShareInvite(invite)
        ? "Link compartilhável"
        : invite.inviteeName,
    }),
    project: snapshot,
    viewerIsMember,
  });
});

router.post("/invites/:token/decline", async (req, res): Promise<void> => {
  const params = tokenParams(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const invite = await loadInviteByToken(params.data.token);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }

  if (invite.status === "declined") {
    res.json(serializeInvite(invite));
    return;
  }

  if (invite.status !== "pending") {
    res.status(400).json({
      error: `Este convite não pode ser recusado (status: ${invite.status}).`,
    });
    return;
  }

  // Link aberto: recusar é só local — não invalida o compartilhamento.
  if (isOpenShareInvite(invite)) {
    res.json(serializeInvite(invite));
    return;
  }

  const [updated] = await db
    .update(projectInvitesTable)
    .set({ status: "declined", declinedAt: new Date() })
    .where(eq(projectInvitesTable.id, invite.id))
    .returning();

  res.json(serializeInvite(updated));
});

router.post(
  "/invites/:token/accept",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = tokenParams(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Token inválido" });
      return;
    }

    const invite = await loadInviteByToken(params.data.token);
    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado" });
      return;
    }

    if (invite.status === "accepted") {
      res.json({
        invite: serializeInvite(invite),
        projectId: invite.projectId,
      });
      return;
    }

    if (invite.status !== "pending") {
      res.status(400).json({
        error: `Este convite não pode ser aceito (status: ${invite.status}).`,
      });
      return;
    }

    const actor = req.appUser!;
    const openShare = isOpenShareInvite(invite);

    if (!openShare) {
      const inviteEmail = (invite.inviteeEmail ?? "").trim().toLowerCase();
      const actorEmail = actor.email.trim().toLowerCase();

      if (
        invite.inviteeUserId != null &&
        invite.inviteeUserId !== actor.id &&
        inviteEmail !== actorEmail
      ) {
        res.status(403).json({
          error: "Este convite foi enviado para outro usuário.",
        });
        return;
      }

      if (invite.inviteeUserId == null && inviteEmail !== actorEmail) {
        res.status(403).json({
          error:
            "Entre com o e-mail convidado ou cadastre-se usando o mesmo e-mail do convite.",
        });
        return;
      }
    }

    const alreadyMember = await isProjectMember(actor.id, invite.projectId);

    if (!alreadyMember) {
      await db.insert(projectMembersTable).values({
        projectId: invite.projectId,
        userId: actor.id,
        role: invite.role,
      });
    } else if (invite.role === "gestor") {
      await db
        .update(projectMembersTable)
        .set({ role: "gestor" })
        .where(
          and(
            eq(projectMembersTable.projectId, invite.projectId),
            eq(projectMembersTable.userId, actor.id),
          ),
        );
    }

    // Link aberto permanece válido para outras pessoas até revogar/expirar.
    let updated = invite;
    if (!openShare) {
      const [row] = await db
        .update(projectInvitesTable)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          inviteeUserId: actor.id,
          inviteeName: actor.name,
        })
        .where(eq(projectInvitesTable.id, invite.id))
        .returning();
      updated = row ?? invite;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, invite.projectId));

    if (!alreadyMember) {
      await runNotify(
        createNotificationsForUsers([invite.invitedByUserId], {
          actorUserId: actor.id,
          type: "project_invite_accepted",
          title: "Convite aceito",
          message: `${actor.name} aceitou participar do projeto "${project?.title ?? ""}".`,
          projectId: invite.projectId,
          link: `/projects/${invite.projectId}`,
        }),
      );

      await runNotify(
        createNotificationsForUsers([actor.id], {
          actorUserId: invite.invitedByUserId,
          type: "member_added",
          title: "Você entrou no projeto",
          message: `Agora você participa de "${project?.title ?? ""}" como ${invite.role}.`,
          projectId: invite.projectId,
          link: `/projects/${invite.projectId}`,
        }),
      );
    }

    res.json({
      invite: serializeInvite(updated),
      projectId: invite.projectId,
    });
  },
);

export default router;
