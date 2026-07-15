import type { User } from "@db";

export function canManageMembers(actor: User): boolean {
  return actor.role === "admin" || actor.role === "gestor";
}

export function assignableRoles(actor: User): Array<User["role"]> {
  if (actor.role === "admin") return ["gestor", "membro"];
  return ["gestor", "membro"];
}

export function canManageMember(actor: User, target: User): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "gestor") return false;
  if (!actor.organizationId || actor.organizationId !== target.organizationId) {
    return false;
  }
  return target.role !== "admin";
}

export function resolveMemberOrganizationId(
  actor: User,
  requestedOrganizationId?: number,
): number | null {
  if (actor.role === "gestor") {
    return actor.organizationId ?? null;
  }
  return requestedOrganizationId ?? null;
}

export function canManageOrganizationMembers(
  actor: User,
  organizationId: number,
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "gestor") return actor.organizationId === organizationId;
  return false;
}

export function canAssignOrganization(
  actor: User,
  target: User,
  organizationId: number,
): boolean {
  if (target.role === "admin") return false;
  if (actor.role === "admin") return true;
  if (actor.role === "gestor") {
    return actor.organizationId === organizationId;
  }
  return false;
}
