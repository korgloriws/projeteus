import type { User } from "@db";

export function getSectorLabel(
  organizationType: "empresa" | "ente_publico",
): string {
  return organizationType === "ente_publico" ? "Secretaria" : "Setor";
}

export function getSectorLabelPlural(
  organizationType: "empresa" | "ente_publico",
): string {
  return organizationType === "ente_publico" ? "Secretarias" : "Setores";
}

export function canManageOrganizationSectors(
  user: User,
  organizationId: number,
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "gestor" && user.organizationId === organizationId) {
    return true;
  }
  return false;
}
