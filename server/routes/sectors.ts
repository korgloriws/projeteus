import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationSectorsTable, organizationsTable } from "@db";
import { requireAuth } from "../middlewares/requireAuth";
import { canManageOrganizationSectors } from "../lib/organization-sectors";

const router: IRouter = Router();

const organizationIdParams = z.object({
  organizationId: z.coerce.number(),
});

const sectorIdParams = z.object({
  id: z.coerce.number(),
});

const createSectorBody = z.object({
  name: z.string().min(1),
});

const updateSectorBody = z.object({
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
  "/organizations/:organizationId/sectors",
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

    const sectors = await db
      .select()
      .from(organizationSectorsTable)
      .where(
        eq(organizationSectorsTable.organizationId, organization.id),
      )
      .orderBy(organizationSectorsTable.name);

    res.json(sectors);
  },
);

router.post(
  "/organizations/:organizationId/sectors",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = organizationIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = createSectorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const organization = await loadOrganization(params.data.organizationId);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (!canManageOrganizationSectors(req.appUser!, organization.id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const trimmedName = parsed.data.name.trim();
    const [existing] = await db
      .select()
      .from(organizationSectorsTable)
      .where(
        and(
          eq(organizationSectorsTable.organizationId, organization.id),
          eq(organizationSectorsTable.name, trimmedName),
        ),
      );

    if (existing) {
      res.status(409).json({
        error: "Já existe um setor com este nome nesta organização.",
      });
      return;
    }

    const [sector] = await db
      .insert(organizationSectorsTable)
      .values({
        organizationId: organization.id,
        name: trimmedName,
      })
      .returning();

    res.status(201).json(sector);
  },
);

router.patch("/sectors/:id", requireAuth, async (req, res): Promise<void> => {
  const params = sectorIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = updateSectorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sector] = await db
    .select()
    .from(organizationSectorsTable)
    .where(eq(organizationSectorsTable.id, params.data.id));

  if (!sector) {
    res.status(404).json({ error: "Sector not found" });
    return;
  }

  if (!canManageOrganizationSectors(req.appUser!, sector.organizationId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const trimmedName = parsed.data.name.trim();
  const [duplicate] = await db
    .select()
    .from(organizationSectorsTable)
    .where(
      and(
        eq(organizationSectorsTable.organizationId, sector.organizationId),
        eq(organizationSectorsTable.name, trimmedName),
      ),
    );

  if (duplicate && duplicate.id !== sector.id) {
    res.status(409).json({
      error: "Já existe um setor com este nome nesta organização.",
    });
    return;
  }

  const [updated] = await db
    .update(organizationSectorsTable)
    .set({ name: trimmedName })
    .where(eq(organizationSectorsTable.id, sector.id))
    .returning();

  res.json(updated);
});

router.delete("/sectors/:id", requireAuth, async (req, res): Promise<void> => {
  const params = sectorIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sector] = await db
    .select()
    .from(organizationSectorsTable)
    .where(eq(organizationSectorsTable.id, params.data.id));

  if (!sector) {
    res.status(404).json({ error: "Sector not found" });
    return;
  }

  if (!canManageOrganizationSectors(req.appUser!, sector.organizationId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .delete(organizationSectorsTable)
    .where(eq(organizationSectorsTable.id, sector.id));

  res.sendStatus(204);
});

export default router;
