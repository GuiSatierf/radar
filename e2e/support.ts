import { type Browser, expect, type Page, test } from "@playwright/test";
import { grantAdminRole, setPlanByEmail } from "../scripts/lib/account-access";
import { createDatabase, type Database } from "../src/db/client";
import type { PlanId } from "../src/features/plans/plans";

export const PASSWORD = "senha-de-teste-123";
// argon2 is slow on purpose, and the machine may be busy with other projects' checks.
export const NAVIGATION_TIMEOUT = 30_000;

let clientCounter = 0;

/**
 * Each test acts as its own visitor: the production build rate-limits sign-ups per client IP,
 * read from x-real-ip, the header the reverse proxy sets (CLIENT_IP_HEADER).
 */
export async function assignFreshClientIp(page: Page): Promise<void> {
  clientCounter += 1;
  const lastOctets = `${(clientCounter >> 8) & 255}.${clientCounter & 255}`;

  await page.setExtraHTTPHeaders({
    "x-real-ip": `10.${process.pid & 255}.${lastOctets}`,
  });
}

/** A second person in the same test, with their own cookies and client IP. */
export async function openAsNewVisitor(browser: Browser): Promise<Page> {
  const { baseURL, locale, viewport } = test.info().project.use;
  const context = await browser.newContext({ baseURL, locale, viewport });
  const page = await context.newPage();
  await assignFreshClientIp(page);

  return page;
}

export function uniqueEmail(testName: string): string {
  const slug = testName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return `${slug}-${Date.now()}@e2e.test`;
}

/** Direct access to the *_test database (checked in playwright.config.ts), for test setup only. */
export async function withTestDatabase<T>(
  work: (db: Database) => Promise<T>,
): Promise<T> {
  const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");

  try {
    return await work(db);
  } finally {
    await pool.end();
  }
}

/** New accounts have no plan; in the app only an admin changes that, so tests set it directly. */
export async function setPlan(email: string, plan: PlanId): Promise<void> {
  await withTestDatabase((db) => setPlanByEmail(db, email, plan));
}

export async function makeAdmin(email: string): Promise<void> {
  await withTestDatabase((db) => grantAdminRole(db, email));
}

export async function signUp(
  page: Page,
  email: string,
  plan?: PlanId,
): Promise<void> {
  await page.goto("/criar-conta");
  await page.getByLabel("Seu nome").fill("Maria Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/radar$/, { timeout: NAVIGATION_TIMEOUT });

  if (plan == null) return;

  await setPlan(email, plan);
  await page.reload();
}
