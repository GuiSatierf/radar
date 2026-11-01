import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../../src/db/client";

const MIGRATIONS_FOLDER = "./drizzle";

export async function migrateDatabase(connectionString: string): Promise<void> {
  const { db, pool } = createDatabase(connectionString);

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
