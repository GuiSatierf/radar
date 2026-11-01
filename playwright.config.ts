import { defineConfig, devices } from "@playwright/test";
import { E2E_OUTBOX_DIR } from "./e2e/outbox";
import { loadEnvFileIfPresent } from "./scripts/lib/file-exists";
import { requireTestDatabaseName } from "./scripts/lib/test-database";

// End-to-end tests run the app against the *_test database, never the development one.
const E2E_PORT = 3211;
const E2E_URL = `http://localhost:${E2E_PORT}`;

await loadEnvFileIfPresent();

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

requireTestDatabaseName(testDatabaseUrl);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_URL,
    locale: "pt-BR",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "celular",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  // The production build, not `next dev`: no file watcher (on Windows it reported phantom
  // changes and reloaded pages mid-test) and closer to what users get.
  webServer: {
    command: `npx next build && npx next start --port ${E2E_PORT}`,
    url: `${E2E_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: E2E_URL,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "e2e-secret-e2e-secret-e2e-secret-e2e",
      // "Esqueci minha senha" writes its e-mails here; the tests read the link back.
      EMAIL_OUTBOX_DIR: E2E_OUTBOX_DIR,
    },
  },
});
