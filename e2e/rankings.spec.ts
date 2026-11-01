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

test("os rankings abrem nos mais vendidos e trocam de lista", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");

  await page.goto("/rankings");

  const rows = page.getByRole("list").last().getByRole("link");
  await expect(rows).toHaveCount(30);
  await expect(rows.first()).toContainText("Você ganha R$");
  await expect(rows.first()).toContainText(/vendas?\/mês/);

  await page.getByRole("link", { name: "Maior ganho" }).click();
  await expect(page).toHaveURL(/lista=ganho/, { timeout: NAVIGATION_TIMEOUT });
  await expect(
    page.getByText("Quanto você ganha em cada venda, já com a sua comissão."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Em alta" }).click();
  await expect(page).toHaveURL(/lista=em-alta/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(
    page.getByText(/começa a aparecer depois de alguns dias de coleta/),
  ).toBeVisible();
});

test("o ranking de um produto abre a ficha dele no Radar", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");
  await page.goto("/rankings");

  await page.getByRole("list").last().getByRole("link").first().click();

  await expect(page).toHaveURL(/\/radar\/[a-z0-9-]+$/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByText("Você ganha por venda")).toBeVisible();
});
