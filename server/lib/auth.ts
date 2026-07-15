import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";

export const SESSION_COOKIE = "projeteus_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = {
  userId: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set");
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(userId: number): string {
  return jwt.sign({ userId } satisfies SessionPayload, getSessionSecret(), {
    expiresIn: "7d",
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, getSessionSecret()) as SessionPayload;
    if (typeof payload.userId !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
