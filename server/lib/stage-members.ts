import { eq, inArray } from "drizzle-orm";
import { db, stageMembersTable } from "@db";

export async function loadStageMemberIds(stageId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: stageMembersTable.userId })
    .from(stageMembersTable)
    .where(eq(stageMembersTable.stageId, stageId));
  return rows.map((row) => row.userId);
}

export async function loadStageMemberIdsForStages(
  stageIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (stageIds.length === 0) return map;
  const rows = await db
    .select({
      stageId: stageMembersTable.stageId,
      userId: stageMembersTable.userId,
    })
    .from(stageMembersTable)
    .where(inArray(stageMembersTable.stageId, stageIds));
  for (const row of rows) {
    const list = map.get(row.stageId) ?? [];
    list.push(row.userId);
    map.set(row.stageId, list);
  }
  return map;
}

export async function replaceStageMembers(
  stageId: number,
  userIds: number[],
): Promise<void> {
  await db.delete(stageMembersTable).where(eq(stageMembersTable.stageId, stageId));
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return;
  await db
    .insert(stageMembersTable)
    .values(unique.map((userId) => ({ stageId, userId })));
}
