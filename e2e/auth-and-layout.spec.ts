import { expect, test } from "@playwright/test";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("quem não entrou é levado para a tela de entrar", async ({ page }) => {
  await page.goto("/radar");

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("a senha nunca vai para o endereço da página, nem antes do JavaScript carregar", async ({
  browser,
}) => {
  // Without JavaScript, a form with no method submits as GET and puts the password in the URL.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const path of ["/entrar", "/criar-conta"]) {
    await page.goto(path);
    await page.getByLabel("E-mail").fill("sem-js@e2e.test");
    await page.getByLabel(/^Senha/).fill("senha-que-nao-pode-vazar");
    // force: the button may be (correctly) disabled until the page is ready.
    await page
      .getByRole("button", { name: /Entrar|Criar conta/ })
      .click({ force: true });
    await page.waitForLoadState("load");

    expect(page.url()).not.toContain("senha-que-nao-pode-vazar");
  }

  await context.close();
});

test("criar conta leva ao Radar com o menu das ferramentas", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));

  const menu = page.getByRole("navigation", { name: "Ferramentas" });

  await expect(
    page.getByRole("heading", { name: "Radar", exact: true }),
  ).toBeVisible();
  await expect(menu.getByRole("link", { name: "Studio" })).toBeVisible();
});

test("no computador, o nome do produto no menu é lido sem a letra do ícone", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the phone menu has no logo");
  await signUp(page, uniqueEmail(testInfo.title));

  await expect(
    page
      .getByRole("navigation", { name: "Ferramentas" })
      .getByRole("link", { name: "Prisciane", exact: true }),
  ).toBeVisible();
});

test("o menu leva de uma ferramenta para outra", async ({ page }, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));

  await page
    .getByRole("navigation", { name: "Ferramentas" })
    .getByRole("link", { name: "Anúncios" })
    .click();

  await expect(page).toHaveURL(/\/anuncios$/, { timeout: NAVIGATION_TIMEOUT });
  await expect(
    page.getByRole("heading", { name: "Anúncios", exact: true }),
  ).toBeVisible();
});

test("senha errada mostra o aviso e não entra", async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  await page.context().clearCookies();

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("outra-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
});

test("trocar para o tema escuro e sair da conta", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/, { timeout: NAVIGATION_TIMEOUT });
});
