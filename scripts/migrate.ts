import { loadLocalEnv, requireVariable } from "./lib/load-env";
import { migrateDatabase } from "./lib/migrate-database";

// `npm run db:migrate` targets DATABASE_URL; `npm run db:migrate -- --test` targets TEST_DATABASE_URL.
await loadLocalEnv();

const variable = process.argv.includes("--test")
  ? "TEST_DATABASE_URL"
  : "DATABASE_URL";

await migrateDatabase(requireVariable(variable));
console.log(`Migrations applied (${variable}).`);
