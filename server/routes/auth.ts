import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable } from "@db";
import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  signSession,
  verifyPassword,
} from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { serializeUser } from "./users";

const router: IRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().min(1),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

  const [totalUsers] = await db
    .select({ count: usersTable.id })
    .from(usersTable);
  const isFirstUser = !totalUsers;

  const passwordHash = await hashPassword(parsed.data.password);
  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      name: parsed.data.name.trim(),
      role: isFirstUser ? "admin" : "membro",
    })
    .returning();

  setSessionCookie(res, signSession(created.id));
  res.status(201).json(serializeUser(created, null));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "E-mail ou senha inválidos" });
    return;
  }

  setSessionCookie(res, signSession(user.id));
  res.json(serializeUser(user, null));
});

router.post("/auth/logout", (_req, res): void => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/session", requireAuth, async (req, res): Promise<void> => {
  res.json(serializeUser(req.appUser!, null));
});

export default router;
