import { Router, type IRouter } from "express";
import { count, eq, or } from "drizzle-orm";
import {
  db,
  organizationPositionsTable,
  organizationSectorsTable,
  organizationsTable,
  projectOrganizationsTable,
  projectsTable,
  usersTable,
} from "@db";
import {
  CreateOrganizationBody,
  GetOrganizationParams,
  UpdateOrganizationBody,
  UpdateOrganizationParams,
} from "@api/zod";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/organizations", requireAuth, async (_req, res): Promise<void> => {
  const orgs = await db
    .select()
    .from(organizationsTable)
    .orderBy(organizationsTable.name);

  const memberCounts = await db
    .select({
      organizationId: usersTable.organizationId,
      memberCount: count(),
    })
    .from(usersTable)
    .groupBy(usersTable.organizationId);

  const countByOrgId = new Map(
    memberCounts
      .filter((row) => row.organizationId !== null)
      .map((row) => [row.organizationId!, row.memberCount]),
  );

  const sectorCounts = await db
    .select({
      organizationId: organizationSectorsTable.organizationId,
      sectorCount: count(),
    })
    .from(organizationSectorsTable)
    .groupBy(organizationSectorsTable.organizationId);

  const sectorCountByOrgId = new Map(
    sectorCounts.map((row) => [row.organizationId, row.sectorCount]),
  );

  const positionCounts = await db
    .select({
      organizationId: organizationPositionsTable.organizationId,
      positionCount: count(),
    })
    .from(organizationPositionsTable)
    .groupBy(organizationPositionsTable.organizationId);

  const positionCountByOrgId = new Map(
    positionCounts.map((row) => [row.organizationId, row.positionCount]),
  );

  res.json(
    orgs.map((org) => ({
      ...org,
      memberCount: countByOrgId.get(org.id) ?? 0,
      sectorCount: sectorCountByOrgId.get(org.id) ?? 0,
      positionCount: positionCountByOrgId.get(org.id) ?? 0,
    })),
  );
});

router.post(
  "/organizations",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateOrganizationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [org] = await db
      .insert(organizationsTable)
      .values(parsed.data)
      .returning();

    res.status(201).json(org);
  },
);

router.get("/organizations/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.appUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = GetOrganizationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, params.data.id));

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(org);
});

router.patch(
  "/organizations/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateOrganizationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateOrganizationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [org] = await db
      .update(organizationsTable)
      .set(parsed.data)
      .where(eq(organizationsTable.id, params.data.id))
      .returning();

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    res.json(org);
  },
);

router.delete(
  "/organizations/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = GetOrganizationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, params.data.id));

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const [linkedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.organizationId, params.data.id))
      .limit(1);

    if (linkedUser) {
      res.status(400).json({
        error: "Não é possível excluir uma organização com membros vinculados.",
      });
      return;
    }

    const [linkedProjectOrg] = await db
      .select()
      .from(projectOrganizationsTable)
      .where(eq(projectOrganizationsTable.organizationId, params.data.id))
      .limit(1);

    const [linkedProject] = linkedProjectOrg
      ? [linkedProjectOrg]
      : await db
          .select()
          .from(projectsTable)
          .where(
            or(
              eq(projectsTable.empresaOrgId, params.data.id),
              eq(projectsTable.entePublicoOrgId, params.data.id),
            ),
          )
          .limit(1);

    if (linkedProject) {
      res.status(400).json({
        error: "Não é possível excluir uma organização vinculada a projetos.",
      });
      return;
    }

    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, params.data.id));

    res.sendStatus(204);
  },
);

export default router;
