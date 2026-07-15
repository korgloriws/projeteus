import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const organizationSectorsTable = sqliteTable(
  "organization_sectors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("organization_sectors_org_name_unique").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const insertOrganizationSectorSchema = createInsertSchema(
  organizationSectorsTable,
).omit({ id: true, createdAt: true });
export type InsertOrganizationSector = z.infer<
  typeof insertOrganizationSectorSchema
>;
export type OrganizationSector = typeof organizationSectorsTable.$inferSelect;
