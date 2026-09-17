import type { Project } from "@api/client";

export const PRIORITY_WEIGHT = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
} as const;

export type ProjectPriorityValue = keyof typeof PRIORITY_WEIGHT;

export function compareProjectsByUrgencyRank(
  a: Pick<Project, "priority" | "priorityRank" | "createdAt" | "id">,
  b: Pick<Project, "priority" | "priorityRank" | "createdAt" | "id">,
): number {
  const weightDiff =
    PRIORITY_WEIGHT[a.priority as ProjectPriorityValue] -
    PRIORITY_WEIGHT[b.priority as ProjectPriorityValue];
  if (weightDiff !== 0) return weightDiff;

  const rankA = a.priorityRank ?? 0;
  const rankB = b.priorityRank ?? 0;
  if (rankA !== rankB) return rankA - rankB;

  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (aTime !== bTime) return aTime - bTime;

  return a.id - b.id;
}

export function sortProjectsByUrgencyRank<T extends Project>(projects: T[]): T[] {
  return [...projects].sort(compareProjectsByUrgencyRank);
}

export const PLACE_FIRST = "__first__";
export const PLACE_LAST = "__last__";

export function resolvePlaceAfterProjectId(
  placeKey: string,
): number | null | undefined {
  if (placeKey === PLACE_LAST) return undefined;
  if (placeKey === PLACE_FIRST) return null;
  const id = Number(placeKey);
  return Number.isFinite(id) ? id : undefined;
}
