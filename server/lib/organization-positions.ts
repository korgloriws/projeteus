import type { User } from "@db";

export function canManageOrganizationPositions(
  user: User,
  organizationId: number,
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "gestor" && user.organizationId === organizationId) {
    return true;
  }
  return false;
}
