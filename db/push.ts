import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pushSQLiteSchema } from "drizzle-kit/api";
import * as schema from "./src/schema/index.js";

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

const client = createClient({ url: dbUrl });
const db = drizzle(client, { schema });

const result = await pushSQLiteSchema(schema, db);

if (result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}

if (result.hasDataLoss) {
  console.warn("Aviso: alterações podem causar perda de dados.");
}

await result.apply();
console.log(`Schema SQLite aplicado em ${dbUrl}`);
client.close();
