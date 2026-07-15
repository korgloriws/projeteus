import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

loadEnv({ override: true });

function resolveDbUrl(): string {
  return process.env.DATABASE_URL ?? "file:./data/projeteus.db";
}

function ensureDataDir(url: string) {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(resolved), { recursive: true });
}

const dbUrl = resolveDbUrl();
ensureDataDir(dbUrl);

export const client = createClient({ url: dbUrl });
export const db = drizzle(client, { schema });

export * from "./schema";
