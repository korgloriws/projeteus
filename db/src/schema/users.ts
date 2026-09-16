import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationPositionsTable } from "./organization-positions";
import { organizationSectorsTable } from "./organization-sectors";
import { organizationsTable } from "./organizations";

export const userRoleValues = ["admin", "gestor", "membro"] as const;

export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoleValues }).notNull().default("membro"),
  organizationId: integer("organization_id").references(
    () => organizationsTable.id,
    { onDelete: "set null" },
  ),
  sectorId: integer("sector_id").references(() => organizationSectorsTable.id, {
    onDelete: "set null",
  }),
  positionId: integer("position_id").references(
    () => organizationPositionsTable.id,
    { onDelete: "set null" },
  ),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
