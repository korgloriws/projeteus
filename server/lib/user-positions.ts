import { eq } from "drizzle-orm";
import { db, organizationPositionsTable } from "@db";

export async function resolvePositionForOrganization(
  positionId: number | null | undefined,
  organizationId: number | null,
): Promise<{ positionId: number | null; error?: string }> {
  if (positionId == null) {
    return { positionId: null };
  }

  if (!organizationId) {
    return {
      positionId: null,
      error: "O membro precisa estar vinculado a uma organização antes de receber um cargo.",
    };
  }

  const [position] = await db
    .select()
    .from(organizationPositionsTable)
    .where(eq(organizationPositionsTable.id, positionId));

  if (!position) {
    return { positionId: null, error: "Cargo não encontrado." };
  }

  if (position.organizationId !== organizationId) {
    return {
      positionId: null,
      error: "O cargo selecionado não pertence à organização do membro.",
    };
  }

  return { positionId };
}
