import { eq } from "drizzle-orm";
import { db, organizationSectorsTable } from "@db";

export async function resolveSectorForOrganization(
  sectorId: number | null | undefined,
  organizationId: number | null,
): Promise<{ sectorId: number | null; error?: string }> {
  if (sectorId == null) {
    return { sectorId: null };
  }

  if (!organizationId) {
    return {
      sectorId: null,
      error: "O membro precisa estar vinculado a uma organização antes de receber um setor.",
    };
  }

  const [sector] = await db
    .select()
    .from(organizationSectorsTable)
    .where(eq(organizationSectorsTable.id, sectorId));

  if (!sector) {
    return { sectorId: null, error: "Setor não encontrado." };
  }

  if (sector.organizationId !== organizationId) {
    return {
      sectorId: null,
      error: "O setor selecionado não pertence à organização do membro.",
    };
  }

  return { sectorId };
}
