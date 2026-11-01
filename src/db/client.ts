import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(connectionString: string): {
  db: Database;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });

  return { db: drizzle(pool, { schema }), pool };
}

let cachedDatabase: Database | null = null;

export function getDatabase(): Database {
  if (cachedDatabase != null) return cachedDatabase;

  cachedDatabase = createDatabase(getServerEnv().DATABASE_URL).db;

  return cachedDatabase;
}
