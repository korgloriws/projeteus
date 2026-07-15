export function sortByOrder<T extends { order?: number | null; id: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id,
  );
}

export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const stageDndId = (stageId: number) => `stage-${stageId}`;
export const taskDndId = (taskId: number) => `task-${taskId}`;
export const stageDropDndId = (stageId: number) => `stage-drop-${stageId}`;

export function parseStageDndId(id: string) {
  return id.startsWith("stage-") && !id.startsWith("stage-drop-")
    ? Number(id.replace("stage-", ""))
    : null;
}

export function parseTaskDndId(id: string) {
  return id.startsWith("task-") ? Number(id.replace("task-", "")) : null;
}

export function parseStageDropDndId(id: string) {
  return id.startsWith("stage-drop-") ? Number(id.replace("stage-drop-", "")) : null;
}
