import { createDatabase } from "../src/db/client";
import { collectAndRecord } from "../src/sources/products/record-collection";
import { selectProductSource } from "../src/sources/products/select-product-source";
import { loadLocalEnv, requireVariable } from "./lib/load-env";

// Updates the catalog by hand: from the Shopee affiliate API when its key is in .env, from the
// fictitious catalog otherwise. Coolify runs the same collection through /api/cron/collect-products.
await loadLocalEnv();

const { db, pool } = createDatabase(requireVariable("DATABASE_URL"));

try {
  const result = await collectAndRecord({
    db,
    source: selectProductSource(process.env),
  });

  console.log(
    `Products saved: ${result.saved}, skipped (invalid): ${result.skipped}, removed: ${result.removed}.`,
  );
} finally {
  await pool.end();
}
