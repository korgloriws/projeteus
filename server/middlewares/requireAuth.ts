import type { NextFunction, Request, Response } from "express";
import { db, usersTable } from "@db";
import { eq } from "drizzle-orm";
import type { User } from "@db";
import { SESSION_COOKIE, verifySession } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      appUser?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Sessão expirada. Entre novamente." });
    return;
  }

  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão expirada. Entre novamente." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  if (!user) {
    res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    return;
  }

  req.appUser = user;
  next();
}

export function requireRole(...roles: Array<User["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.appUser || !roles.includes(req.appUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
