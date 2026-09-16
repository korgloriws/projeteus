import type { Project, User } from "@db";

/** A user can see a project if they are an admin, or belong to either of
 * the two organizations collaborating on it. */
export function canAccessProject(user: User, project: Project): boolean {
  if (user.role === "admin") return true;
  if (!user.organizationId) return false;
  return (
    user.organizationId === project.empresaOrgId ||
    user.organizationId === project.entePublicoOrgId
  );
}
