import { createDatabase } from "../src/db/client";
import { todayInBrazil } from "../src/features/ads/domain/ads";
import { collectAdsAndRecord } from "../src/sources/ads/collect-ads";
import { createFakeAdSource } from "../src/sources/ads/fake-ad-source";
import { loadLocalEnv, requireVariable } from "./lib/load-env";

// Run locally and by the seed. Only the demo source exists today; an automatic collector or a supplier plugs in
// here (and in the cron route) once the client decides, without touching any screen.
await loadLocalEnv();

const { db, pool } = createDatabase(requireVariable("DATABASE_URL"));

try {
  const result = await collectAdsAndRecord({
    db,
    source: createFakeAdSource(todayInBrazil(new Date())),
  });

  console.log(
    `Ads saved: ${result.saved}, skipped (invalid): ${result.skipped}, stopped: ${result.stopped}.`,
  );
} finally {
  await pool.end();
}
