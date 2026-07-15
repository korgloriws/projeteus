import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationPositionsTable, organizationSectorsTable, organizationsTable, usersTable } from "@db";
import {
  UpdateUserRoleBody,
  UpdateUserRoleParams,
} from "@api/zod";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { hashPassword, verifyPassword } from "../lib/auth";
import {
  assignableRoles,
  canAssignOrganization,
  canManageMember,
  canManageMembers,
  resolveMemberOrganizationId,
} from "../lib/members";
import { resolveSectorForOrganization } from "../lib/user-sectors";
import { resolvePositionForOrganization } from "../lib/user-positions";

const router: IRouter = Router();

const createMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["gestor", "membro"]).optional(),
  organizationId: z.number().optional(),
  sectorId: z.number().nullable().optional(),
  positionId: z.number().nullable().optional(),
});

const updateMyAccountSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.newPassword !== undefined,
    { message: "Nenhuma alteração informada." },
  );

const adminUpdateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined,
    { message: "Nenhuma alteração informada." },
  );

async function isEmailTaken(email: string, ignoreUserId: number): Promise<boolean> {
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return Boolean(existing) && existing.id !== ignoreUserId;
}

function serializeUser(
  user: typeof usersTable.$inferSelect,
  org: typeof organizationsTable.$inferSelect | null,
  sector: typeof organizationSectorsTable.$inferSelect | null = null,
  position: typeof organizationPositionsTable.$inferSelect | null = null,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: org,
    sectorId: user.sectorId ?? null,
    sector: sector
      ? {
          id: sector.id,
          name: sector.name,
          organizationId: sector.organizationId,
        }
      : null,
    positionId: user.positionId ?? null,
    position: position
      ? {
          id: position.id,
          name: position.name,
          organizationId: position.organizationId,
        }
      : null,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

async function loadUserProfile(user: typeof usersTable.$inferSelect) {
  let org = null;
  let sector = null;
  let position = null;

  if (user.organizationId) {
    const [row] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, user.organizationId));
    org = row ?? null;
  }

  if (user.sectorId) {
    const [row] = await db
      .select()
      .from(organizationSectorsTable)
      .where(eq(organizationSectorsTable.id, user.sectorId));
    sector = row ?? null;
  }

  if (user.positionId) {
    const [row] = await db
      .select()
      .from(organizationPositionsTable)
      .where(eq(organizationPositionsTable.id, user.positionId));
    position = row ?? null;
  }

  return serializeUser(user, org, sector, position);
}

export { serializeUser, loadUserProfile };

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  res.json(await loadUserProfile(req.appUser!));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;
  const parsed = updateMyAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name.trim();
  }

  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase();
    if (email !== actor.email && (await isEmailTaken(email, actor.id))) {
      res.status(409).json({ error: "E-mail já cadastrado." });
      return;
    }
    updates.email = email;
  }

  if (parsed.data.newPassword !== undefined) {
    if (!parsed.data.currentPassword) {
      res
        .status(400)
        .json({ error: "Informe a senha atual para definir uma nova senha." });
      return;
    }

    const validCurrent = await verifyPassword(
      parsed.data.currentPassword,
      actor.passwordHash,
    );
    if (!validCurrent) {
      res.status(400).json({ error: "Senha atual incorreta." });
      return;
    }

    updates.passwordHash = await hashPassword(parsed.data.newPassword);
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, actor.id))
    .returning();

  res.json(await loadUserProfile(updated));
});

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      user: usersTable,
      org: organizationsTable,
      sector: organizationSectorsTable,
      position: organizationPositionsTable,
    })
    .from(usersTable)
    .leftJoin(
      organizationsTable,
      eq(usersTable.organizationId, organizationsTable.id),
    )
    .leftJoin(
      organizationSectorsTable,
      eq(usersTable.sectorId, organizationSectorsTable.id),
    )
    .leftJoin(
      organizationPositionsTable,
      eq(usersTable.positionId, organizationPositionsTable.id),
    )
    .orderBy(usersTable.name);

  const visible =
    req.appUser!.role === "admin"
      ? rows
      : rows.filter((row) => row.user.organizationId === req.appUser!.organizationId);

  res.json(
    visible.map((row) => serializeUser(row.user, row.org, row.sector, row.position)),
  );
});

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;

  if (!canManageMembers(actor)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const role = parsed.data.role ?? "membro";
  if (!assignableRoles(actor).includes(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const organizationId = resolveMemberOrganizationId(
    actor,
    parsed.data.organizationId,
  );

  if (!organizationId) {
    res.status(400).json({ error: "Selecione a organização do membro." });
    return;
  }

  const [organization] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId));

  if (!organization) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const sectorResolution = await resolveSectorForOrganization(
    parsed.data.sectorId,
    organizationId,
  );
  if (sectorResolution.error) {
    res.status(400).json({ error: sectorResolution.error });
    return;
  }

  const positionResolution = await resolvePositionForOrganization(
    parsed.data.positionId,
    organizationId,
  );
  if (positionResolution.error) {
    res.status(400).json({ error: positionResolution.error });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing) {
    res.status(409).json({ error: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      name: parsed.data.name.trim(),
      role,
      organizationId,
      sectorId: sectorResolution.sectorId,
      positionId: positionResolution.positionId,
    })
    .returning();

  res.status(201).json(await loadUserProfile(created));
});

router.patch("/users/:id/organization", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;

  if (!canManageMembers(actor)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = z
    .object({
      organizationId: z.number(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!canAssignOrganization(actor, target, parsed.data.organizationId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [organization] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, parsed.data.organizationId));

  if (!organization) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ organizationId: parsed.data.organizationId, sectorId: null, positionId: null })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  res.json(await loadUserProfile(updated));
});

router.patch("/users/:id/sector", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;

  if (!canManageMembers(actor)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = z
    .object({
      sectorId: z.number().nullable(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!canManageMember(actor, target)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const sectorResolution = await resolveSectorForOrganization(
    parsed.data.sectorId,
    target.organizationId,
  );
  if (sectorResolution.error) {
    res.status(400).json({ error: sectorResolution.error });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ sectorId: sectorResolution.sectorId })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  res.json(await loadUserProfile(updated));
});

router.patch("/users/:id/position", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;

  if (!canManageMembers(actor)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = z
    .object({
      positionId: z.number().nullable(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!canManageMember(actor, target)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const positionResolution = await resolvePositionForOrganization(
    parsed.data.positionId,
    target.organizationId,
  );
  if (positionResolution.error) {
    res.status(400).json({ error: positionResolution.error });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ positionId: positionResolution.positionId })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  res.json(await loadUserProfile(updated));
});

router.patch(
  "/users/:id/role",
  requireAuth,
  async (req, res): Promise<void> => {
    const actor = req.appUser!;

    if (!canManageMembers(actor)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const params = UpdateUserRoleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateUserRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!assignableRoles(actor).includes(parsed.data.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));

    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!canManageMember(actor, target)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role: parsed.data.role })
      .where(eq(usersTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(await loadUserProfile(updated));
  },
);

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const actor = req.appUser!;

  if (!canManageMembers(actor)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = adminUpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const isSelf = target.id === actor.id;
  const canEdit =
    isSelf || actor.role === "admin" || canManageMember(actor, target);
  if (!canEdit) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name.trim();
  }

  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase();
    if (email !== target.email && (await isEmailTaken(email, target.id))) {
      res.status(409).json({ error: "E-mail já cadastrado." });
      return;
    }
    updates.email = email;
  }

  if (parsed.data.password !== undefined) {
    updates.passwordHash = await hashPassword(parsed.data.password);
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, target.id))
    .returning();

  res.json(await loadUserProfile(updated));
});

router.delete(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (params.data.id === req.appUser!.id) {
      res.status(400).json({ error: "Você não pode excluir sua própria conta." });
      return;
    }

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));

    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (target.role === "admin") {
      res.status(400).json({ error: "Não é possível excluir um administrador." });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, params.data.id));

    res.sendStatus(204);
  },
);

export default router;
