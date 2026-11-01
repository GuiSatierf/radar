import { expect, test } from "@playwright/test";
import { assignFreshClientIp, signUp, uniqueEmail } from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("os termos e a privacidade abrem sem conta, a partir do cadastro", async ({
  page,
}) => {
  await page.goto("/criar-conta");

  await page
    .getByRole("navigation", { name: "Termos e privacidade" })
    .getByRole("link", { name: "Termos de uso" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Termos de uso", level: 1 }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Política de privacidade" }).click();

  await expect(
    page.getByRole("heading", { name: "Política de privacidade", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/Atualizado em \d+ de \S+ de \d{4}/),
  ).toBeVisible();
});

test("o cadastro avisa que criar a conta aceita os termos", async ({
  page,
}) => {
  await page.goto("/criar-conta");

  const notice = page.getByText("Ao criar a conta, você concorda com os");

  await expect(notice).toBeVisible();
  await expect(
    notice.getByRole("link", { name: "Termos de uso" }),
  ).toHaveAttribute("href", "/termos");
  await expect(
    notice.getByRole("link", { name: "Política de privacidade" }),
  ).toHaveAttribute("href", "/privacidade");
});

test("quem já entrou acha os termos nas configurações", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));
  await page.goto("/configuracoes");

  await page
    .getByRole("navigation", { name: "Termos e privacidade" })
    .getByRole("link", { name: "Política de privacidade" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Política de privacidade", level: 1 }),
  ).toBeVisible();
});
