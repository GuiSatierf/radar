import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  PASSWORD,
  signUp,
  uniqueEmail,
} from "./support";

const NEW_PASSWORD = "senha-trocada-456";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

/** The same person on a second device, with its own cookies and client IP. */
async function signInElsewhere(
  browser: Browser,
  email: string,
  password: string,
): Promise<Page> {
  const { baseURL, locale, viewport } = test.info().project.use;
  const context = await browser.newContext({ baseURL, locale, viewport });
  const page = await context.newPage();
  await assignFreshClientIp(page);

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/radar$/, { timeout: NAVIGATION_TIMEOUT });

  return page;
}

async function fillChangePassword(
  page: Page,
  input: { current: string; next: string },
): Promise<void> {
  await page.getByLabel("Senha atual").fill(input.current);
  await page.getByLabel(/^Senha nova/).fill(input.next);
  await page.getByLabel("Repita a senha nova").fill(input.next);
  await page.getByRole("button", { name: "Salvar senha nova" }).click();
}

test("errar a senha atual não troca nada", async ({ page }, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));
  await page.goto("/configuracoes/senha");

  await fillChangePassword(page, {
    current: "senha-errada-123",
    next: NEW_PASSWORD,
  });

  await expect(
    page.getByRole("alert").filter({ hasText: "A senha atual está errada." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/configuracoes\/senha$/);
});

test("trocar a senha nas configurações tira a conta do outro aparelho", async ({
  page,
  browser,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  const otherDevice = await signInElsewhere(browser, email, PASSWORD);

  await page.goto("/configuracoes");
  await page.getByRole("link", { name: "Trocar senha" }).click();
  await fillChangePassword(page, { current: PASSWORD, next: NEW_PASSWORD });

  await expect(
    page.getByText("Senha trocada. Os outros aparelhos saíram da conta."),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(page).toHaveURL(/\/configuracoes$/);

  await otherDevice.reload();
  await expect(otherDevice).toHaveURL(/\/entrar$/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await otherDevice.context().close();

  const withNewPassword = await signInElsewhere(browser, email, NEW_PASSWORD);
  await withNewPassword.context().close();
});
