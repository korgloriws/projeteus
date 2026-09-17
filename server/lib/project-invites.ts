import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  organizationsTable,
  projectInvitesTable,
  projectMembersTable,
  projectsTable,
  stagesTable,
  tasksTable,
  usersTable,
  type ProjectInvite,
  type User,
} from "@db";
import { getProjectOrganizationsByType } from "./project-organizations";
import {
  canManageProjectTeam,
  isProjectGestor,
  isProjectMember,
} from "./project-members";

export const INVITE_TTL_DAYS = 14;

export function buildInviteToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

export function inviteExpiresAt(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + INVITE_TTL_DAYS);
  return expires;
}

export function inviteLinkPath(token: string): string {
  return `/invite/${token}`;
}

/** Origem pública do app (link compartilhável). Sempre com porta se APP_PORT existir. */
export function getPublicAppOrigin(): string {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.WEB_ORIGIN?.trim() ||
    "";
  if (!raw) return "";

  try {
    const url = new URL(raw);
    // Se WEB_ORIGIN veio sem porta (cai na 80), força APP_PORT do compose (ex.: 3020).
    if (!url.port && process.env.APP_PORT?.trim()) {
      url.port = process.env.APP_PORT.trim();
    }
    return url.origin.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function inviteAbsoluteUrl(token: string): string {
  const path = inviteLinkPath(token);
  const origin = getPublicAppOrigin();
  if (!origin) return path;
  return `${origin}${path}`;
}

/** Link externo sem e-mail/usuário fixo — qualquer pessoa com o link pode ver/aceitar. */
export function isOpenShareInvite(invite: {
  channel: string;
  inviteeUserId: number | null;
  inviteeEmail: string | null;
}): boolean {
  if (invite.channel !== "external") return false;
  if (invite.inviteeUserId != null) return false;
  const email = invite.inviteeEmail?.trim() ?? "";
  return email.length === 0;
}

export async function canSendProjectInvites(
  user: User,
  projectId: number,
): Promise<boolean> {
  if (user.role === "admin") return true;
  return isProjectGestor(user.id, projectId);
}

export async function markExpiredInvite(
  invite: ProjectInvite,
): Promise<ProjectInvite> {
  if (invite.status !== "pending") return invite;
  if (invite.expiresAt.getTime() > Date.now()) return invite;

  const [updated] = await db
    .update(projectInvitesTable)
    .set({ status: "expired" })
    .where(eq(projectInvitesTable.id, invite.id))
    .returning();
  return updated ?? { ...invite, status: "expired" };
}

export async function loadInviteByToken(
  token: string,
): Promise<ProjectInvite | null> {
  const [invite] = await db
    .select()
    .from(projectInvitesTable)
    .where(eq(projectInvitesTable.token, token));
  if (!invite) return null;
  return markExpiredInvite(invite);
}

export async function buildPublicProjectSnapshot(projectId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  if (!project) return null;

  const { empresaOrgIds, entePublicoOrgIds } =
    await getProjectOrganizationsByType(project.id);

  const orgIds = [...new Set([...empresaOrgIds, ...entePublicoOrgIds])];
  const orgs =
    orgIds.length === 0
      ? []
      : await db
          .select()
          .from(organizationsTable)
          .where(inArray(organizationsTable.id, orgIds));

  const orgById = new Map(orgs.map((org) => [org.id, org]));

  const stages = await db
    .select({
      id: stagesTable.id,
      name: stagesTable.name,
      order: stagesTable.order,
      status: stagesTable.status,
      dueDate: stagesTable.dueDate,
    })
    .from(stagesTable)
    .where(eq(stagesTable.projectId, project.id))
    .orderBy(asc(stagesTable.order), asc(stagesTable.id));

  const tasks = await db
    .select({
      id: tasksTable.id,
      stageId: tasksTable.stageId,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      order: tasksTable.order,
    })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, project.id))
    .orderBy(asc(tasksTable.order), asc(tasksTable.id));

  const completedTasks = tasks.filter((task) => task.status === "concluida").length;
  const progressPercent =
    tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    priority: project.priority,
    priorityRank: project.priorityRank,
    dueDate: project.dueDate,
    createdAt: project.createdAt,
    empresaOrgs: empresaOrgIds
      .map((id) => orgById.get(id))
      .filter(Boolean)
      .map((org) => ({ id: org!.id, name: org!.name, type: org!.type })),
    entePublicoOrgs: entePublicoOrgIds
      .map((id) => orgById.get(id))
      .filter(Boolean)
      .map((org) => ({ id: org!.id, name: org!.name, type: org!.type })),
    progressPercent,
    totalStages: stages.length,
    totalTasks: tasks.length,
    completedTasks,
    stages: stages.map((stage) => ({
      ...stage,
      tasks: tasks
        .filter((task) => task.stageId === stage.id)
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          order: task.order,
        })),
    })),
  };
}

export function serializeInvite(
  invite: ProjectInvite,
  extras?: {
    projectTitle?: string;
    invitedByName?: string;
    inviteeNameResolved?: string | null;
  },
) {
  return {
    id: invite.id,
    token: invite.token,
    projectId: invite.projectId,
    invitedByUserId: invite.invitedByUserId,
    inviteeUserId: invite.inviteeUserId,
    inviteeEmail: invite.inviteeEmail,
    inviteeName: invite.inviteeName,
    role: invite.role,
    channel: invite.channel,
    status: invite.status,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    declinedAt: invite.declinedAt,
    createdAt: invite.createdAt,
    link: inviteLinkPath(invite.token),
    /** URL absoluta do produto para enviar por e-mail / WhatsApp. */
    url: inviteAbsoluteUrl(invite.token),
    projectTitle: extras?.projectTitle,
    invitedByName: extras?.invitedByName,
    inviteeNameResolved: extras?.inviteeNameResolved ?? invite.inviteeName,
  };
}

export async function listProjectInvites(projectId: number) {
  const rows = await db
    .select({
      invite: projectInvitesTable,
      projectTitle: projectsTable.title,
      invitedByName: usersTable.name,
    })
    .from(projectInvitesTable)
    .innerJoin(projectsTable, eq(projectInvitesTable.projectId, projectsTable.id))
    .innerJoin(usersTable, eq(projectInvitesTable.invitedByUserId, usersTable.id))
    .where(eq(projectInvitesTable.projectId, projectId))
    .orderBy(desc(projectInvitesTable.createdAt));

  const inviteeIds = rows
    .map((row) => row.invite.inviteeUserId)
    .filter((id): id is number => id != null);
  const invitees =
    inviteeIds.length === 0
      ? []
      : await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(inArray(usersTable.id, inviteeIds));
  const inviteeNameById = new Map(invitees.map((user) => [user.id, user.name]));

  const serialized = [];
  for (const row of rows) {
    const invite = await markExpiredInvite(row.invite);
    serialized.push(
      serializeInvite(invite, {
        projectTitle: row.projectTitle,
        invitedByName: row.invitedByName,
        inviteeNameResolved:
          (invite.inviteeUserId
            ? inviteeNameById.get(invite.inviteeUserId)
            : null) ??
          invite.inviteeName ??
          (isOpenShareInvite(invite) ? "Link compartilhável" : null),
      }),
    );
  }
  return serialized;
}

export async function findPendingInviteConflict(params: {
  projectId: number;
  email: string;
  userId?: number | null;
}): Promise<ProjectInvite | null> {
  const email = params.email.trim().toLowerCase();
  const pending = await db
    .select()
    .from(projectInvitesTable)
    .where(
      and(
        eq(projectInvitesTable.projectId, params.projectId),
        eq(projectInvitesTable.status, "pending"),
        eq(projectInvitesTable.inviteeEmail, email),
      ),
    );

  for (const invite of pending) {
    const current = await markExpiredInvite(invite);
    if (current.status === "pending") return current;
  }

  if (params.userId != null) {
    const byUser = await db
      .select()
      .from(projectInvitesTable)
      .where(
        and(
          eq(projectInvitesTable.projectId, params.projectId),
          eq(projectInvitesTable.status, "pending"),
          eq(projectInvitesTable.inviteeUserId, params.userId),
        ),
      );
    for (const invite of byUser) {
      const current = await markExpiredInvite(invite);
      if (current.status === "pending") return current;
    }
  }

  return null;
}

export { canManageProjectTeam, isProjectMember };
