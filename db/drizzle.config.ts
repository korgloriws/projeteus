import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: path.join(root, "src/schema"),
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/projeteus.db",
  },
});
