import { createDatabase } from "../src/db/client";
import { todayInBrazil } from "../src/features/ads/domain/ads";
import { createAuth } from "../src/lib/auth";
import { parseServerEnv } from "../src/lib/env";
import { collectAdsAndRecord } from "../src/sources/ads/collect-ads";
import { seedDemoAds } from "../src/sources/ads/demo-ads";
import { createFakeAdSource } from "../src/sources/ads/fake-ad-source";
import { createFakeProductSource } from "../src/sources/products/fake-product-source";
import { collectAndRecord } from "../src/sources/products/record-collection";
import { grantAdminRole, setPlanByEmail } from "./lib/account-access";
import { loadLocalEnv, requireVariable } from "./lib/load-env";
import { seedDemoAccount } from "./lib/seed-demo";

// Fictitious data for local development and the demo environment. Never run against production.
await loadLocalEnv();

const env = parseServerEnv(process.env);
const { db, pool } = createDatabase(env.DATABASE_URL);

try {
  const demoEmail = requireVariable("SEED_DEMO_EMAIL");
  const account = await seedDemoAccount({
    auth: createAuth(db, env),
    db,
    account: {
      name: "Conta de demonstração",
      email: demoEmail,
      password: requireVariable("SEED_DEMO_PASSWORD"),
    },
  });
  // The demo shows every tool; another account is needed to see the locked screens.
  await setPlanByEmail(db, demoEmail, "pro");
  const admin = await grantAdminRole(db, process.env.ADMIN_EMAIL);
  const products = await collectAndRecord({
    db,
    source: createFakeProductSource(),
  });

  const today = todayInBrazil(new Date());
  const ads = await seedDemoAds(db, today);
  const collected = await collectAdsAndRecord({
    db,
    source: createFakeAdSource(today),
  });

  console.log(
    `Demo account: ${account} (plan pro). Admin: ${admin}. Demo products: ${products.saved}. New manual demo ads: ${ads}. Collected demo ads: ${collected.saved}.`,
  );
} finally {
  await pool.end();
}
