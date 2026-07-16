import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { client, db } from "./index";
import {
  commentsTable,
  attachmentsTable,
  organizationsTable,
  projectMembersTable,
  projectsTable,
  stagesTable,
  tasksTable,
  usersTable,
} from "./schema";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "mateus@projeteus.local";
const adminName = process.env.SEED_ADMIN_NAME ?? "Mateus";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "projeteus";

async function seed() {
  await db.delete(attachmentsTable);
  await db.delete(commentsTable);
  await db.delete(tasksTable);
  await db.delete(stagesTable);
  await db.delete(projectMembersTable);
  await db.delete(projectsTable);
  await db.delete(usersTable);
  await db.delete(organizationsTable);
  await db.run(sql`DELETE FROM sqlite_sequence`);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await db.insert(usersTable).values({
    email: adminEmail,
    passwordHash,
    name: adminName,
    role: "admin",
  });

  console.log("Banco resetado. Usuário admin criado:");
  console.log(`  e-mail: ${adminEmail}`);
  console.log(`  senha:  ${adminPassword}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.close());
