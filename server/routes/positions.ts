import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationPositionsTable, organizationsTable } from "@db";
import { requireAuth } from "../middlewares/requireAuth";
import { canManageOrganizationPositions } from "../lib/organization-positions";

const router: IRouter = Router();

const organizationIdParams = z.object({
  organizationId: z.coerce.number(),
});

const positionIdParams = z.object({
  id: z.coerce.number(),
});

const createPositionBody = z.object({
  name: z.string().min(1),
});

const updatePositionBody = z.object({
  name: z.string().min(1),
});

async function loadOrganization(organizationId: number) {
  const [organization] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId));
  return organization ?? null;
}

router.get(
  "/organizations/:organizationId/positions",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = organizationIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const organization = await loadOrganization(params.data.organizationId);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const positions = await db
      .select()
      .from(organizationPositionsTable)
      .where(eq(organizationPositionsTable.organizationId, organization.id))
      .orderBy(organizationPositionsTable.name);

    res.json(positions);
  },
);

router.post(
  "/organizations/:organizationId/positions",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = organizationIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = createPositionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const organization = await loadOrganization(params.data.organizationId);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (!canManageOrganizationPositions(req.appUser!, organization.id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const trimmedName = parsed.data.name.trim();
    const [existing] = await db
      .select()
      .from(organizationPositionsTable)
      .where(
        and(
          eq(organizationPositionsTable.organizationId, organization.id),
          eq(organizationPositionsTable.name, trimmedName),
        ),
      );

    if (existing) {
      res.status(409).json({
        error: "Já existe um cargo com este nome nesta organização.",
      });
      return;
    }

    const [position] = await db
      .insert(organizationPositionsTable)
      .values({
        organizationId: organization.id,
        name: trimmedName,
      })
      .returning();

    res.status(201).json(position);
  },
);

router.patch("/positions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = positionIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = updatePositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [position] = await db
    .select()
    .from(organizationPositionsTable)
    .where(eq(organizationPositionsTable.id, params.data.id));

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  if (!canManageOrganizationPositions(req.appUser!, position.organizationId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const trimmedName = parsed.data.name.trim();
  const [duplicate] = await db
    .select()
    .from(organizationPositionsTable)
    .where(
      and(
        eq(organizationPositionsTable.organizationId, position.organizationId),
        eq(organizationPositionsTable.name, trimmedName),
      ),
    );

  if (duplicate && duplicate.id !== position.id) {
    res.status(409).json({
      error: "Já existe um cargo com este nome nesta organização.",
    });
    return;
  }

  const [updated] = await db
    .update(organizationPositionsTable)
    .set({ name: trimmedName })
    .where(eq(organizationPositionsTable.id, position.id))
    .returning();

  res.json(updated);
});

router.delete("/positions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = positionIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [position] = await db
    .select()
    .from(organizationPositionsTable)
    .where(eq(organizationPositionsTable.id, params.data.id));

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  if (!canManageOrganizationPositions(req.appUser!, position.organizationId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .delete(organizationPositionsTable)
    .where(eq(organizationPositionsTable.id, position.id));

  res.sendStatus(204);
});

export default router;
