import { loadEnvFileIfPresent } from "../scripts/lib/file-exists";
import { requireTestDatabaseName } from "../scripts/lib/test-database";

await loadEnvFileIfPresent();

requireTestDatabaseName(process.env.TEST_DATABASE_URL);
