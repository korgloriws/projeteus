import { and, eq } from "drizzle-orm";
import { db, projectMembersTable, usersTable, type Project, type User } from "@db";
import {
  getProjectOrganizationIds,
} from "./project-organizations";

function userBelongsToOrganizationIds(
  organizationId: number | null,
  orgIds: number[],
): boolean {
  if (!organizationId) return false;
  return orgIds.includes(organizationId);
}

export async function belongsToProjectOrganizations(
  user: User,
  project: Pick<Project, "id">,
): Promise<boolean> {
  if (!user.organizationId) return false;
  const orgIds = await getProjectOrganizationIds(project.id);
  return userBelongsToOrganizationIds(user.organizationId, orgIds);
}

export function isEligibleProjectGestorForOrganizations(
  user: User,
  organizationIds: number[],
): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "gestor") return false;
  return userBelongsToOrganizationIds(user.organizationId, organizationIds);
}

export async function isEligibleProjectMember(
  user: User,
  project: Pick<Project, "id">,
): Promise<boolean> {
  if (user.role === "admin") return true;
  return belongsToProjectOrganizations(user, project);
}

export function canManageProjectTeam(
  actor: User,
  isActorProjectGestor: boolean,
): boolean {
  if (actor.role === "admin") return true;
  return isActorProjectGestor;
}

export async function isProjectGestor(
  userId: number,
  projectId: number,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.userId, userId),
        eq(projectMembersTable.role, "gestor"),
      ),
    );
  return Boolean(row);
}

export async function isProjectMember(
  userId: number,
  projectId: number,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.userId, userId),
      ),
    );
  return Boolean(row);
}

export async function userHasProjectAccess(
  user: User,
  project: Project,
): Promise<boolean> {
  if (user.role === "admin") return true;
  return isProjectMember(user.id, project.id);
}

export async function canManageProjectTasks(
  user: User,
  project: Project,
): Promise<boolean> {
  if (user.role === "admin") return true;
  return isProjectGestor(user.id, project.id);
}

export async function isValidTaskAssignee(
  project: Project,
  assigneeUserId: number,
): Promise<boolean> {
  if (await isProjectMember(assigneeUserId, project.id)) return true;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, assigneeUserId));
  if (!user) return false;
  return isEligibleProjectMember(user, project);
}

export async function areValidTaskAssignees(
  project: Project,
  assigneeUserIds: number[],
): Promise<boolean> {
  if (assigneeUserIds.length === 0) return false;
  for (const assigneeUserId of assigneeUserIds) {
    if (!(await isValidTaskAssignee(project, assigneeUserId))) {
      return false;
    }
  }
  return true;
}
