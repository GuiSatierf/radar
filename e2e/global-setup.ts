import { rm } from "node:fs/promises";
import { loadEnvFileIfPresent } from "../scripts/lib/file-exists";
import { migrateDatabase } from "../scripts/lib/migrate-database";
import { requireTestDatabaseName } from "../scripts/lib/test-database";
import { createDatabase } from "../src/db/client";
import { ad } from "../src/db/schema";
import { todayInBrazil } from "../src/features/ads/domain/ads";
import { collectAds } from "../src/sources/ads/collect-ads";
import { seedDemoAds } from "../src/sources/ads/demo-ads";
import { createFakeAdSource } from "../src/sources/ads/fake-ad-source";
import { collectProducts } from "../src/sources/products/collect-products";
import { createFakeProductSource } from "../src/sources/products/fake-product-source";
import { E2E_OUTBOX_DIR } from "./outbox";

/** Before the browser tests: the _test database is migrated and holds the demo catalog. */
export default async function globalSetup(): Promise<void> {
  await loadEnvFileIfPresent();

  const url = process.env.TEST_DATABASE_URL ?? "";
  requireTestDatabaseName(url);
  await migrateDatabase(url);
  await rm(E2E_OUTBOX_DIR, { recursive: true, force: true });

  const { db, pool } = createDatabase(url);

  try {
    await collectProducts({
      db,
      source: createFakeProductSource(),
      now: new Date(),
    });
    // Ads left by integration tests would change the order the browser tests expect.
    await db.delete(ad);
    const today = todayInBrazil(new Date());
    await seedDemoAds(db, today);
    await collectAds({ db, source: createFakeAdSource(today), today });
  } finally {
    await pool.end();
  }
}
