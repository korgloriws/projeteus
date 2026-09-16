import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { organizationsTable } from "./organizations";
import { projectsTable } from "./projects";

export const projectOrganizationsTable = sqliteTable(
  "project_organizations",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.organizationId] }),
  ],
);
