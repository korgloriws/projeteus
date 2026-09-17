import { eq } from "drizzle-orm";
import {
  db,
  projectsTable,
  projectPriorityValues,
  type Project,
} from "@db";

export type ProjectPriority = (typeof projectPriorityValues)[number];

/** Menor peso = mais urgente (aparece primeiro). */
export const PRIORITY_WEIGHT: Record<ProjectPriority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export function compareProjectsByUrgencyRank(
  a: Pick<Project, "priority" | "priorityRank" | "createdAt" | "id">,
  b: Pick<Project, "priority" | "priorityRank" | "createdAt" | "id">,
): number {
  const weightDiff =
    PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
  if (weightDiff !== 0) return weightDiff;

  const rankDiff = a.priorityRank - b.priorityRank;
  if (rankDiff !== 0) return rankDiff;

  const aTime =
    a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt);
  const bTime =
    b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt);
  if (aTime !== bTime) return aTime - bTime;

  return a.id - b.id;
}

async function listPriorityGroup(
  priority: ProjectPriority,
  excludeId?: number,
): Promise<Project[]> {
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.priority, priority));

  const filtered =
    excludeId == null
      ? rows
      : rows.filter((row) => row.id !== excludeId);

  return filtered.sort(compareProjectsByUrgencyRank);
}

async function writeContiguousRanks(orderedIds: number[]): Promise<void> {
  for (let index = 0; index < orderedIds.length; index++) {
    const id = orderedIds[index]!;
    await db
      .update(projectsTable)
      .set({ priorityRank: index + 1 })
      .where(eq(projectsTable.id, id));
  }
}

/** Garante ranks 1..N contíguos por grupo (backfill de installs antigas). */
export async function ensurePriorityRanksBackfilled(): Promise<void> {
  for (const priority of projectPriorityValues) {
    const group = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.priority, priority));

    if (group.length === 0) continue;

    const ranks = group.map((row) => row.priorityRank);
    const hasInvalid = ranks.some((rank) => rank <= 0);
    const positive = ranks.filter((rank) => rank > 0);
    const hasDuplicates = new Set(positive).size !== positive.length;
    const maxRank = ranks.length === 0 ? 0 : Math.max(...ranks);
    const hasGaps =
      !hasInvalid && !hasDuplicates && maxRank !== group.length;

    if (!hasInvalid && !hasDuplicates && !hasGaps) continue;

    // Preserva ordem relativa já existente quando ranks > 0; senão createdAt.
    const ordered = [...group].sort((a, b) => {
      const aHasRank = a.priorityRank > 0;
      const bHasRank = b.priorityRank > 0;
      if (aHasRank && bHasRank && a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return compareProjectsByUrgencyRank(a, b);
    });

    await writeContiguousRanks(ordered.map((row) => row.id));
  }
}

/**
 * Posiciona o projeto dentro do grupo da urgência.
 * - `placeAfterProjectId === undefined` → último
 * - `placeAfterProjectId === null` → primeiro
 * - `placeAfterProjectId === number` → imediatamente após esse id do mesmo grupo
 */
export async function placeProjectInPriorityGroup(params: {
  projectId: number;
  priority: ProjectPriority;
  placeAfterProjectId?: number | null;
}): Promise<void> {
  const { projectId, priority, placeAfterProjectId } = params;
  const peers = await listPriorityGroup(priority, projectId);
  const orderedIds = peers.map((row) => row.id);

  if (placeAfterProjectId === undefined) {
    orderedIds.push(projectId);
  } else if (placeAfterProjectId === null) {
    orderedIds.unshift(projectId);
  } else {
    const afterIndex = orderedIds.indexOf(placeAfterProjectId);
    if (afterIndex === -1) {
      orderedIds.push(projectId);
    } else {
      orderedIds.splice(afterIndex + 1, 0, projectId);
    }
  }

  await db
    .update(projectsTable)
    .set({ priority, priorityRank: 0 })
    .where(eq(projectsTable.id, projectId));

  await writeContiguousRanks(orderedIds);
}

/** Renumerar um grupo após remoção ou mudança de urgência. */
export async function renumberPriorityGroup(
  priority: ProjectPriority,
): Promise<void> {
  const group = await listPriorityGroup(priority);
  await writeContiguousRanks(group.map((row) => row.id));
}

/**
 * Reordena o grupo inteiro. `orderedIds` deve listar todos os projetos
 * daquela urgência (exceto se `movingId` já estiver incluído).
 */
export async function reorderPriorityGroup(params: {
  priority: ProjectPriority;
  orderedIds: number[];
}): Promise<void> {
  const { priority, orderedIds } = params;
  const group = await listPriorityGroup(priority);
  const groupIds = new Set(group.map((row) => row.id));

  if (orderedIds.length !== groupIds.size) {
    throw new Error(
      "A lista de ordenação precisa incluir todos os projetos desta urgência.",
    );
  }

  for (const id of orderedIds) {
    if (!groupIds.has(id)) {
      throw new Error(
        "Só é possível reordenar projetos que compartilham a mesma urgência.",
      );
    }
  }

  await writeContiguousRanks(orderedIds);
}

export async function moveProjectToPriority(params: {
  projectId: number;
  fromPriority: ProjectPriority;
  toPriority: ProjectPriority;
  placeAfterProjectId?: number | null;
}): Promise<void> {
  const { projectId, fromPriority, toPriority, placeAfterProjectId } = params;

  if (fromPriority === toPriority) {
    if (placeAfterProjectId !== undefined) {
      await placeProjectInPriorityGroup({
        projectId,
        priority: toPriority,
        placeAfterProjectId,
      });
    }
    return;
  }

  await placeProjectInPriorityGroup({
    projectId,
    priority: toPriority,
    placeAfterProjectId:
      placeAfterProjectId === undefined ? undefined : placeAfterProjectId,
  });
  await renumberPriorityGroup(fromPriority);
}

/** Após deletar o projeto, renumerar o grupo restante. */
export async function renumberAfterProjectRemoved(
  priority: ProjectPriority,
): Promise<void> {
  await renumberPriorityGroup(priority);
}
