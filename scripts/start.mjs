// Container entrypoint: apply pending migrations, then start the standalone Next.js server.
// Lives in /migrate inside the image, next to its own drizzle-orm and pg (the standalone output
// does not carry the migrator).
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Any fixed number works; it only has to be the same for every container of this app.
const MIGRATION_LOCK_ID = 7_210_001;

/**
 * Makes the account with ADMIN_EMAIL an admin. Only an account that already exists: the person
 * signs up first, then the e-mail goes into the variable and the app restarts. Mirrors
 * grantAdminRole in scripts/lib/account-access.ts (this file cannot import TypeScript).
 */
async function grantAdminRole(client, email) {
  if (email == null || email.trim().length === 0) return;

  const result = await client.query(
    `update "user" set role = 'admin' where email = $1`,
    [email.trim().toLowerCase()],
  );
  // No e-mail in the log: it is personal data.
  console.log(
    result.rowCount === 0
      ? "ADMIN_EMAIL has no account yet; sign up first, then restart."
      : "Admin role granted to ADMIN_EMAIL.",
  );
}

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl == null || databaseUrl.trim().length === 0) {
  console.error("DATABASE_URL is missing; refusing to start.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const lockClient = await pool.connect();

try {
  // During a rolling deploy two containers start together; the second waits here,
  // then finds nothing pending.
  await lockClient.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  await migrate(drizzle(lockClient), { migrationsFolder: "/app/drizzle" });
  console.log("Migrations applied.");
  await grantAdminRole(lockClient, process.env.ADMIN_EMAIL);
} finally {
  await lockClient.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
  lockClient.release();
  await pool.end();
}

await import("/app/server.js");
