import { eq, inArray } from "drizzle-orm";
import {
  db,
  organizationsTable,
  projectOrganizationsTable,
  projectsTable,
} from "@db";

export async function getProjectOrganizationIds(
  projectId: number,
): Promise<number[]> {
  const rows = await db
    .select({ organizationId: projectOrganizationsTable.organizationId })
    .from(projectOrganizationsTable)
    .where(eq(projectOrganizationsTable.projectId, projectId));

  if (rows.length > 0) {
    return rows.map((row) => row.organizationId);
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) return [];
  return [project.empresaOrgId, project.entePublicoOrgId];
}

export async function getProjectOrganizationsByType(projectId: number) {
  const orgIds = await getProjectOrganizationIds(projectId);
  if (orgIds.length === 0) {
    return { empresaOrgIds: [] as number[], entePublicoOrgIds: [] as number[] };
  }

  const orgs = await db
    .select()
    .from(organizationsTable)
    .where(inArray(organizationsTable.id, orgIds));

  const empresaOrgIds: number[] = [];
  const entePublicoOrgIds: number[] = [];

  for (const org of orgs) {
    if (org.type === "empresa") empresaOrgIds.push(org.id);
    if (org.type === "ente_publico") entePublicoOrgIds.push(org.id);
  }

  return { empresaOrgIds, entePublicoOrgIds };
}

export async function syncProjectOrganizations(
  projectId: number,
  organizationIds: number[],
) {
  const uniqueIds = [...new Set(organizationIds)];

  await db
    .delete(projectOrganizationsTable)
    .where(eq(projectOrganizationsTable.projectId, projectId));

  if (uniqueIds.length === 0) return;

  await db.insert(projectOrganizationsTable).values(
    uniqueIds.map((organizationId) => ({
      projectId,
      organizationId,
    })),
  );
}

export async function validateProjectOrganizationSelection(
  empresaOrgIds: number[],
  entePublicoOrgIds: number[],
): Promise<{ organizationIds: number[]; error?: string }> {
  if (empresaOrgIds.length === 0 || entePublicoOrgIds.length === 0) {
    return {
      organizationIds: [],
      error: "Selecione ao menos uma empresa e um ente público.",
    };
  }

  const allIds = [...new Set([...empresaOrgIds, ...entePublicoOrgIds])];
  const orgs = await db
    .select()
    .from(organizationsTable)
    .where(inArray(organizationsTable.id, allIds));

  if (orgs.length !== allIds.length) {
    return { organizationIds: [], error: "Organização não encontrada." };
  }

  const orgById = new Map(orgs.map((org) => [org.id, org]));

  for (const id of empresaOrgIds) {
    if (orgById.get(id)?.type !== "empresa") {
      return {
        organizationIds: [],
        error: "Todas as empresas selecionadas precisam ser do tipo Empresa.",
      };
    }
  }

  for (const id of entePublicoOrgIds) {
    if (orgById.get(id)?.type !== "ente_publico") {
      return {
        organizationIds: [],
        error:
          "Todos os entes selecionados precisam ser do tipo Ente Público.",
      };
    }
  }

  return { organizationIds: allIds };
}
