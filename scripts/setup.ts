import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { fileExists } from "./lib/file-exists";
import { loadLocalEnv, requireVariable } from "./lib/load-env";
import { buildLocalEnv } from "./lib/local-env";
import { migrateDatabase } from "./lib/migrate-database";
import { runCommandOrThrow } from "./lib/run-command";
import { requireTestDatabaseName } from "./lib/test-database";

// One command for a fresh clone: .env, local Postgres, test database, migrations and demo data.
const ENV_FILE = ".env";
const ENV_EXAMPLE_FILE = ".env.example";

async function createEnvFile(): Promise<void> {
  if (await fileExists(ENV_FILE)) return;

  const example = await readFile(ENV_EXAMPLE_FILE, "utf8");
  const secret = randomBytes(32).toString("base64url");

  await writeFile(ENV_FILE, buildLocalEnv(example, secret));
  console.log(
    ".env created from .env.example with a random secret; the demo account is admin.",
  );
}

async function createTestDatabase(input: {
  adminUrl: string;
  name: string;
}): Promise<void> {
  const client = new Client({ connectionString: input.adminUrl });
  await client.connect();

  try {
    const found = await client.query(
      "select 1 from pg_database where datname = $1",
      [input.name],
    );

    if (found.rowCount != null && found.rowCount > 0) return;

    // requireTestDatabaseName allows only [a-z0-9_], so the name is safe to inline.
    await client.query(`create database ${input.name}`);
    console.log(`Database ${input.name} created.`);
  } finally {
    await client.end();
  }
}

await createEnvFile();
await loadLocalEnv();
await runCommandOrThrow("docker", ["compose", "up", "-d", "--wait"]);

const databaseUrl = requireVariable("DATABASE_URL");
const testDatabaseUrl = requireVariable("TEST_DATABASE_URL");

await createTestDatabase({
  adminUrl: databaseUrl,
  name: requireTestDatabaseName(testDatabaseUrl),
});
await migrateDatabase(databaseUrl);
await migrateDatabase(testDatabaseUrl);
await runCommandOrThrow("npm", ["run", "db:seed"]);

console.log("\nReady. Run `npm run dev` and open http://localhost:3210");
