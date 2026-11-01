import { expect, test } from "@playwright/test";
import { confirmationLinkFor } from "./outbox";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

const NOTICE = { name: "Confirme seu e-mail" };

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("quem cria a conta vê o aviso, abre o link do e-mail e o aviso some", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  await expect(page.getByRole("region", NOTICE)).toBeVisible();

  await page.goto(await confirmationLinkFor(email));

  await expect(
    page.getByRole("status").filter({ hasText: "E-mail confirmado" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(page.getByRole("region", NOTICE)).toHaveCount(0);
});

test("o link que não vale mais avisa e o aviso para pedir outro continua", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  const link = await confirmationLinkFor(email);

  await page.goto(link.replace(/token=[^&]+/, "token=link-estragado"));

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Esse link venceu ou não vale mais" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(page.getByRole("region", NOTICE)).toBeVisible();
});
