import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { projectMemberRoleValues } from "./project-members";
import { usersTable } from "./users";

export const projectInviteChannelValues = ["internal", "external"] as const;
export const projectInviteStatusValues = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
] as const;

export const projectInvitesTable = sqliteTable(
  "project_invites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    inviteeUserId: integer("invitee_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeName: text("invitee_name"),
    role: text("role", { enum: projectMemberRoleValues })
      .notNull()
      .default("membro"),
    channel: text("channel", { enum: projectInviteChannelValues }).notNull(),
    status: text("status", { enum: projectInviteStatusValues })
      .notNull()
      .default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    declinedAt: integer("declined_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("project_invites_project_idx").on(table.projectId, table.status),
    index("project_invites_email_idx").on(table.inviteeEmail),
    uniqueIndex("project_invites_token_unique").on(table.token),
  ],
);

export const insertProjectInviteSchema = createInsertSchema(
  projectInvitesTable,
).omit({ id: true, createdAt: true });
export type InsertProjectInvite = z.infer<typeof insertProjectInviteSchema>;
export type ProjectInvite = typeof projectInvitesTable.$inferSelect;
